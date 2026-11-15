import { searchWeb } from "../providers/travily.provider.js";
import { generateWithGroq } from "../providers/groq.provider.js";
import { extractClaims } from "../agents/claim-extractor.agent.js";
import { verifyClaims } from "../agents/claim-verifier.agent.js";
import { buildTrustAssessment } from "./trust-assessment.service.js";
import { assessSources } from "./source-quality.service.js";
import { cacheService } from "./cache.service.js";
import { budgetService } from "./budget.service.js";
import CONFIG from "../config/constants.js";

function summarizeVerifications(verifications) {
    return {
        supported: verifications.filter((item) => item.status === CONFIG.STATUSES.SUPPORTED).length,
        partiallySupported: verifications.filter((item) => item.status === CONFIG.STATUSES.PARTIALLY_SUPPORTED).length,
        contradicted: verifications.filter((item) => item.status === CONFIG.STATUSES.CONTRADICTED).length,
        insufficientEvidence: verifications.filter((item) => item.status === CONFIG.STATUSES.INSUFFICIENT_EVIDENCE).length,
        technicalFailures: verifications.filter((item) => item.status === CONFIG.STATUSES.VERIFICATION_ERROR).length
    };
}

function buildSourceFreshness(sources) {
    const dated = sources
        .map((source) => ({ source, date: source.publishedDate ? new Date(source.publishedDate) : null }))
        .filter((entry) => entry.date && !Number.isNaN(entry.date.getTime()));
    const timestamps = dated.map((entry) => entry.date.getTime()).sort((a, b) => a - b);
    return {
        totalSources: sources.length,
        datedSources: dated.length,
        undatedSources: sources.length - dated.length,
        oldestPublishedDate: timestamps.length ? new Date(timestamps[0]).toISOString() : null,
        newestPublishedDate: timestamps.length ? new Date(timestamps[timestamps.length - 1]).toISOString() : null,
        note: dated.length
            ? "Dates reflect publication metadata supplied by the search provider; undated sources cannot be assigned a publication date."
            : "The search provider supplied no usable publication dates. Source freshness could not be established."
    };
}

/**
 * Executes the complete evidence-aware research and verification pipeline.
 * Adheres strictly to free-tier budget limits, caching, and multi-step verification.
 */
export async function researchAndAnswer(query, options = {}) {
    const trimmedQuery = query.trim();
    const cacheKey = `research:${trimmedQuery.toLowerCase()}`;

    // 1. Check research cache if not explicitly bypassed
    if (!options.bypassCache) {
        const cachedResult = cacheService.get(cacheKey);
        if (cachedResult) {
            console.log(`[Cache Hit] Full research report: "${trimmedQuery.slice(0, 50)}..."`);
            return {
                ...cachedResult,
                usage: {
                    ...cachedResult.usage,
                    cacheHit: true
                }
            };
        }
    }

    const budget = budgetService.createRequestTracker();
    budgetService.recordResearchRequest();

    // STEP 1: Web research within budget
    console.log("Step 1: Searching the web with Tavily...");
    if (!budget.consumeSearch(false)) {
        throw new Error("Research search budget limit reached for this request");
    }

    const research = await searchWeb(trimmedQuery, {
        maxResults: CONFIG.MAX_SOURCES_PER_SEARCH
    });

    let sources = research.sources || [];

    if (sources.length === 0) {
        throw new Error("No relevant web sources could be found for this query");
    }

    // STEP 2: Assess source quality & diversity
    console.log("Step 2: Assessing source quality and diversity...");
    const qualityResult = assessSources(sources);
    sources = qualityResult.sources;

    // STEP 3: Format evidence for answer synthesis
    console.log("Step 3: Synthesizing research report with Groq...");
    const evidenceText = sources
        .map((s) => `
SOURCE ID: [${s.id}]
TITLE: ${s.title}
URL: ${s.url}
PUBLISHED DATE: ${s.publishedDate || "Not provided by the search provider"}
DOMAIN: ${s.quality?.domain || "web"}
CATEGORY: ${s.quality?.categoryLabel || "General"}
CONTENT:
${(s.content || "").slice(0, 2500)}
`).join("\n-------------------\n");

    const answerPrompt = `
You are VeriMind AI, an evidence-grounded research intelligence platform.

USER RESEARCH QUESTION:
${trimmedQuery}

RETRIEVED WEB EVIDENCE:
${evidenceText}

EDITORIAL GUIDELINES:
1. Synthesize a comprehensive, analytical research report answering the user's question directly.
2. Structure the report with clear Markdown sections:
   - ## Executive Summary (concise high-level synthesis)
   - ## Key Findings (structured bullet points with direct citations)
   - ## Detailed Analysis (mechanisms, contexts, background)
   - ## Contradictions & Open Questions (unresolved points, disagreements)
   - ## Research Limitations (scope bounds, potential data latency)
3. CITE SOURCES EXPLICITLY using bracketed notation matching SOURCE IDs: [1], [2], etc.
4. Every material assertion MUST reference its corresponding source ID.
5. If sources disagree or evidence is ambiguous, state the discrepancy transparently.
6. Do not fabricate citations or facts not present in the retrieved evidence.
7. In Research Limitations, describe publication-date coverage only from explicit PUBLISHED DATE metadata above. Do not invent a latest evidence year or infer a page publication date from dates mentioned inside its text.
8. If publication dates are unavailable for some or all sources, explicitly say freshness cannot be fully established.
`;

    const answer = await generateWithGroq(answerPrompt);

    // STEP 4: Extract atomic claims
    console.log("Step 4: Extracting atomic claims...");
    const claimResult = await extractClaims(answer, sources);
    const extractedClaims = claimResult.claims || [];
    budget.recordClaims(extractedClaims.length);

    // STEP 5: Initial claim verification
    console.log("Step 5: Running initial claim verification pass...");
    let verificationResult = extractedClaims.length > 0
        ? await verifyClaims(extractedClaims, sources)
        : {
            totalClaims: 0,
            summary: { supported: 0, partiallySupported: 0, contradicted: 0, insufficientEvidence: 0, technicalFailures: 0 },
            verifications: []
        };

    // STEP 6: Claim-Level Evidence Retrieval (Targeted gap-filling)
    // Identify claims marked as insufficient_evidence and perform targeted re-retrieval if within budget
    const unresolvedClaims = verificationResult.verifications.filter(
        (v) => v.status === CONFIG.STATUSES.INSUFFICIENT_EVIDENCE
    );

    if (unresolvedClaims.length > 0 && budget.canReverify()) {
        console.log(`Step 6: Found ${unresolvedClaims.length} unresolved claim(s). Attempting targeted re-verification...`);
        
        // Take unresolved claims up to remaining search budget
        const claimsToReverify = unresolvedClaims.slice(0, budget.maxSearches - budget.searchesUsed);

        for (const claim of claimsToReverify) {
            if (!budget.canSearch()) break;

            const targetedQuery = claim.claim.length > 90
                ? claim.claim.slice(0, 90).replace(/[^\w\s]/g, "")
                : claim.claim;

            console.log(`[Targeted Retrieval] Searching for claim ${claim.claimId}: "${targetedQuery}"`);
            budget.consumeSearch(true);

            try {
                const addlResearch = await searchWeb(targetedQuery, {
                    maxResults: 3
                });

                // Deduplicate sources by URL
                const existingUrls = new Set(sources.map((s) => s.url));
                const newSources = (addlResearch.sources || []).filter(
                    (s) => !existingUrls.has(s.url)
                );

                if (newSources.length > 0) {
                    // Assign new IDs continuing from existing count
                    const startId = sources.length + 1;
                    const formattedNewSources = newSources.map((ns, idx) => ({
                        ...ns,
                        id: startId + idx
                    }));

                    // Assess quality of new sources
                    const assessedNew = assessSources(formattedNewSources);
                    sources.push(...assessedNew.sources);

                    // Re-run verification for this specific claim against all available sources
                    const reverifySingle = await verifyClaims([claim], sources);
                    const updatedVerif = reverifySingle.verifications[0];

                    if (updatedVerif) {
                        const originalIndex = verificationResult.verifications.findIndex(
                            (v) => v.claimId === claim.claimId
                        );

                        if (originalIndex !== -1) {
                            const isValidResult =
                                updatedVerif.claimId === claim.claimId &&
                                updatedVerif.claim === claim.claim &&
                                [
                                    CONFIG.STATUSES.SUPPORTED,
                                    CONFIG.STATUSES.PARTIALLY_SUPPORTED,
                                    CONFIG.STATUSES.CONTRADICTED,
                                    CONFIG.STATUSES.INSUFFICIENT_EVIDENCE
                                ].includes(updatedVerif.status);

                            if (isValidResult) {
                                verificationResult.verifications[originalIndex] = {
                                    ...updatedVerif,
                                    reverified: true,
                                    originalStatus: claim.status,
                                    statusChanged: updatedVerif.status !== claim.status,
                                    reverificationQuery: targetedQuery,
                                    newEvidenceCount: formattedNewSources.length,
                                    reverificationAttempt: { status: "succeeded", timestamp: new Date().toISOString() }
                                };
                                console.log(`Claim ${claim.claimId} re-verified: ${claim.status} -> ${updatedVerif.status}`);
                            } else {
                                verificationResult.verifications[originalIndex] = {
                                    ...claim,
                                    reverificationAttempt: {
                                        status: "failed",
                                        code: updatedVerif.verificationError?.code || "INVALID_REVERIFICATION_RESULT",
                                        message: "The retry did not return a valid factual determination; the previous result was kept.",
                                        timestamp: new Date().toISOString()
                                    }
                                };
                            }
                        }
                    }
                }
            } catch (err) {
                const originalIndex = verificationResult.verifications.findIndex((item) => item.claimId === claim.claimId);
                if (originalIndex !== -1) {
                    verificationResult.verifications[originalIndex] = {
                        ...claim,
                        reverificationAttempt: {
                            status: "failed",
                            code: "TARGETED_RESEARCH_FAILED",
                            message: "Targeted evidence retrieval failed; the previous verification result was kept.",
                            timestamp: new Date().toISOString()
                        }
                    };
                }
                console.warn(`[Targeted Retrieval Warning] Re-search failed for ${claim.claimId}:`, err.message);
            }
        }

        // Re-calculate summary counts after re-verification
        verificationResult.summary = {
            supported: verificationResult.verifications.filter((v) => v.status === CONFIG.STATUSES.SUPPORTED).length,
            partiallySupported: verificationResult.verifications.filter((v) => v.status === CONFIG.STATUSES.PARTIALLY_SUPPORTED).length,
            contradicted: verificationResult.verifications.filter((v) => v.status === CONFIG.STATUSES.CONTRADICTED).length,
            insufficientEvidence: verificationResult.verifications.filter((v) => v.status === CONFIG.STATUSES.INSUFFICIENT_EVIDENCE).length,
            technicalFailures: verificationResult.verifications.filter((v) => v.status === CONFIG.STATUSES.VERIFICATION_ERROR).length
        };
    }

    // Re-assess source diversity with any newly retrieved sources
    const finalQualityResult = assessSources(sources);

    // STEP 7: Build Trust Assessment
    console.log("Step 7: Building trust assessment...");
    const trustAssessment = buildTrustAssessment(
        verificationResult,
        finalQualityResult.diversity
    );

    const fullResult = {
        query: trimmedQuery,
        timestamp: new Date().toISOString(),
        answer,
        sources: finalQualityResult.sources,
        claims: claimResult,
        verification: verificationResult,
        trustAssessment,
        usage: budget.getReport(),
        sourceFreshness: buildSourceFreshness(finalQualityResult.sources)
    };

    // Cache the complete result
    cacheService.set(cacheKey, fullResult, CONFIG.RESEARCH_CACHE_TTL_MINUTES);

    console.log("VeriMind research & verification completed successfully!");
    return fullResult;
}

/**
 * Manually re-verifies a specific claim on-demand with a targeted search.
 * Respects research budget and appends newly retrieved sources.
 */
export async function reverifySpecificClaim(claimId, claimText, existingSources = [], reportContext = {}) {
    if (!claimId || !claimText) {
        throw new Error("claimId and claimText are required for manual re-verification");
    }

    const budget = budgetService.createRequestTracker();
    if (!budget.consumeSearch(true)) {
        throw new Error("Search budget exceeded. Additional re-verification searches are currently limited.");
    }

    const focusedQuery = claimText.length > 90
        ? claimText.slice(0, 90).replace(/[^A-Za-z0-9 ]/g, "")
        : claimText;
    const searchResult = await searchWeb(focusedQuery, { maxResults: 3 });

    const existingUrls = new Set(existingSources.map((source) => source.url));
    const newSources = (searchResult.sources || []).filter((source) => !existingUrls.has(source.url));
    let allSources = [...existingSources];

    if (newSources.length > 0) {
        const startId = allSources.length + 1;
        const formattedNew = newSources.map((source, index) => ({
            ...source,
            id: startId + index
        }));
        const assessedNew = assessSources(formattedNew);
        allSources.push(...assessedNew.sources);
    }

    const singleClaim = [{ id: claimId, text: claimText }];
    const reverifyResult = await verifyClaims(singleClaim, allSources);
    const verification = reverifyResult.verifications[0] || null;
    const validStatuses = [
        CONFIG.STATUSES.SUPPORTED,
        CONFIG.STATUSES.PARTIALLY_SUPPORTED,
        CONFIG.STATUSES.CONTRADICTED,
        CONFIG.STATUSES.INSUFFICIENT_EVIDENCE
    ];
    const succeeded = Boolean(
        verification &&
        verification.claimId === claimId &&
        verification.claim === claimText &&
        validStatuses.includes(verification.status)
    );

    const previousVerifications = Array.isArray(reportContext.verifications)
        ? reportContext.verifications
        : [];
    const mergedVerifications = previousVerifications.some((item) => item.claimId === claimId)
        ? previousVerifications.map((item) => item.claimId === claimId && succeeded ? {
            ...verification,
            reverified: true,
            originalStatus: item.status,
            statusChanged: item.status !== verification.status,
            reverificationAttempt: { status: "succeeded", timestamp: new Date().toISOString() }
        } : item)
        : verification ? [verification] : [];

    const finalQualityResult = assessSources(allSources);
    const trustAssessment = buildTrustAssessment(
        { verifications: mergedVerifications },
        finalQualityResult.diversity
    );

    return {
        success: succeeded,
        attempt: succeeded
            ? { status: "succeeded" }
            : {
                status: "failed",
                code: verification?.verificationError?.code || "INVALID_REVERIFICATION_RESULT",
                message: "No valid claim-level determination was returned; the previous verification result must be kept."
            },
        claimId,
        verification,
        verificationSummary: summarizeVerifications(mergedVerifications),
        trustAssessment,
        newSourcesAdded: newSources.length,
        allSources: finalQualityResult.sources,
        sourceFreshness: buildSourceFreshness(finalQualityResult.sources)
    };
}

export default { researchAndAnswer, reverifySpecificClaim };
