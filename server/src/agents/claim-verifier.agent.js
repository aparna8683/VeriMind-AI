import { generateJsonWithGroq } from "../providers/groq.provider.js";
import CONFIG from "../config/constants.js";

const VALID_STATUSES = [
    CONFIG.STATUSES.SUPPORTED,
    CONFIG.STATUSES.PARTIALLY_SUPPORTED,
    CONFIG.STATUSES.CONTRADICTED,
    CONFIG.STATUSES.INSUFFICIENT_EVIDENCE
];

/**
 * Normalizes text for robust excerpt matching (collapsing whitespace, lowercasing, stripping smart quotes).
 */
function normalizeText(text) {
    if (!text || typeof text !== "string") return "";
    return text
        .toLowerCase()
        .replace(/[\u2018\u2019]/g, "'")
        .replace(/[\u201C\u201D]/g, '"')
        .replace(/[\r\n\t]+/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Validates whether an excerpt genuinely appears in the source content.
 * Allows slight punctuation or whitespace differences.
 */
function isExcerptInSource(excerpt, sourceContent) {
    if (!excerpt || !sourceContent) return false;
    const normExcerpt = normalizeText(excerpt);
    const normSource = normalizeText(sourceContent);

    if (normExcerpt.length < 10) return false; // reject trivial fragments

    if (normSource.includes(normExcerpt)) return true;

    // Fallback: check if the first 40 characters and last 40 characters match
    if (normExcerpt.length > 80) {
        const startChunk = normExcerpt.slice(0, 45);
        const endChunk = normExcerpt.slice(-45);
        if (normSource.includes(startChunk) && normSource.includes(endChunk)) {
            return true;
        }
    }

    return false;
}

/**
 * Verifies extracted claims against retrieved web evidence.
 * Batches claims to stay within LLM token limits and validates all returned excerpts.
 */
export async function verifyClaims(claims, sources) {
    if (!Array.isArray(claims) || claims.length === 0) {
        return {
            totalClaims: 0,
            summary: {
                supported: 0,
                partiallySupported: 0,
                contradicted: 0,
                insufficientEvidence: 0
            },
            verifications: []
        };
    }

    if (!Array.isArray(sources) || sources.length === 0) {
        return {
            totalClaims: claims.length,
            summary: {
                supported: 0,
                partiallySupported: 0,
                contradicted: 0,
                insufficientEvidence: claims.length
            },
            verifications: claims.map((c) => ({
                claimId: c.id,
                claim: c.text,
                status: CONFIG.STATUSES.INSUFFICIENT_EVIDENCE,
                rationale: "No retrieved web sources were available for verification.",
                evidence: [],
                reviewNeeded: true,
                reviewReason: "Absence of retrieved reference sources.",
                availableEvidenceSummary: "No sources retrieved.",
                missingEvidence: "Primary or secondary source documentation.",
                recommendedAction: "Perform a web search targeting this claim."
            }))
        };
    }

    const sourceMap = new Map(sources.map((s) => [s.id, s]));

    const evidenceForModel = sources.map((s) => ({
        id: s.id,
        title: s.title,
        url: s.url,
        content: (s.content || "").slice(0, 1800)
    }));

    const batchSize = 4;
    const allResults = [];

    for (let i = 0; i < claims.length; i += batchSize) {
        const batch = claims.slice(i, i + batchSize);

        const prompt = `
You are the Claim Verification Agent for VeriMind AI.

Your responsibility is to strictly evaluate factual claims using ONLY the provided web evidence.

CLAIMS TO VERIFY:
${JSON.stringify(batch, null, 2)}

AVAILABLE EVIDENCE SOURCES:
${JSON.stringify(evidenceForModel, null, 2)}

VERIFICATION CRITERIA:
1. "supported": The retrieved evidence explicitly confirms all factual elements of the claim.
2. "partially_supported": The evidence corroborates parts of the claim, but lacks evidence for secondary elements or numbers.
3. "contradicted": The evidence explicitly disproves or directly conflicts with the factual claim.
4. "insufficient_evidence": The evidence does not contain direct proof or denial. Discussing a related topic is NOT proof.

STRICT EVIDENCE RULES:
- Do NOT use internal background knowledge; rely solely on the supplied text.
- Every piece of evidence MUST include a direct verbatim "excerpt" from the source content.
- If you cannot cite a direct quotation from the source text, the status MUST be "insufficient_evidence".
- For every claim, explain the reasoning in "rationale".
- If the claim is contradicted, partially supported, insufficient, or a compound claim, provide:
  - "reviewReason": Why human review is needed.
  - "availableEvidenceSummary": What evidence actually shows.
  - "missingEvidence": What specific proof is missing.
  - "recommendedAction": Practical step for human investigator.

Return JSON in this format:
{
    "verifications": [
        {
            "claimId": "C1",
            "status": "supported",
            "rationale": "Directly confirmed by Source 1.",
            "evidence": [
                {
                    "sourceId": 1,
                    "excerpt": "Verbatim quote from source content."
                }
            ],
            "reviewNeeded": false,
            "reviewReason": null,
            "availableEvidenceSummary": "Full corroboration found in Source 1.",
            "missingEvidence": null,
            "recommendedAction": "Claim is well-supported by retrieved evidence."
        }
    ]
}
`;

        const result = await generateJsonWithGroq(prompt);

        if (result && Array.isArray(result.verifications)) {
            allResults.push(...result.verifications);
        } else {
            console.warn(`[Verifier Warning] Invalid response for batch starting at index ${i}`);
        }
    }

    const verificationMap = new Map(allResults.map((item) => [item.claimId, item]));

    const verifications = claims.map((claim) => {
        const item = verificationMap.get(claim.id);

        if (!item || !VALID_STATUSES.includes(item.status)) {
            return {
                claimId: claim.id,
                claim: claim.text,
                status: CONFIG.STATUSES.INSUFFICIENT_EVIDENCE,
                rationale: "Automated verification returned an inconclusive or invalid response.",
                evidence: [],
                isCompound: Boolean(claim.isCompound),
                subAssertions: claim.subAssertions || [],
                reviewNeeded: true,
                reviewReason: "Verification model failed to reach a structured determination.",
                availableEvidenceSummary: "Inconclusive.",
                missingEvidence: "Direct quotation corroboration.",
                recommendedAction: "Manually review the cited sources."
            };
        }

        // Validate excerpts against actual source content to prevent hallucinations
        const validatedEvidence = (Array.isArray(item.evidence) ? item.evidence : [])
            .filter((entry) => {
                const source = sourceMap.get(entry.sourceId);
                if (!source || typeof entry.excerpt !== "string") return false;
                return isExcerptInSource(entry.excerpt, source.content);
            })
            .slice(0, CONFIG.MAX_EVIDENCE_SOURCES_PER_CLAIM || 3)
            .map((entry) => {
                const source = sourceMap.get(entry.sourceId);
                return {
                    sourceId: entry.sourceId,
                    sourceTitle: source.title,
                    url: source.url,
                    excerpt: entry.excerpt.trim()
                };
            });

        // If status was marked supported or contradicted but no valid verbatim excerpt survived validation,
        // demote to insufficient_evidence to prevent unsubstantiated claims
        let finalStatus = item.status;
        let finalRationale = item.rationale || "No rationale provided.";

        if ((finalStatus === CONFIG.STATUSES.SUPPORTED || finalStatus === CONFIG.STATUSES.CONTRADICTED) && validatedEvidence.length === 0) {
            finalStatus = CONFIG.STATUSES.INSUFFICIENT_EVIDENCE;
            finalRationale = "Model suggested support/contradiction, but no matching verbatim excerpt could be validated in source texts.";
        }

        const isFlagged =
            finalStatus === CONFIG.STATUSES.CONTRADICTED ||
            finalStatus === CONFIG.STATUSES.INSUFFICIENT_EVIDENCE ||
            finalStatus === CONFIG.STATUSES.PARTIALLY_SUPPORTED ||
            Boolean(claim.isCompound);

        return {
            claimId: claim.id,
            claim: claim.text,
            status: finalStatus,
            rationale: finalRationale,
            evidence: validatedEvidence,
            isCompound: Boolean(claim.isCompound),
            subAssertions: claim.subAssertions || [],
            reviewNeeded: isFlagged,
            reviewReason: item.reviewReason || (
                finalStatus === CONFIG.STATUSES.CONTRADICTED
                    ? "Direct conflict between claim and retrieved evidence."
                    : finalStatus === CONFIG.STATUSES.INSUFFICIENT_EVIDENCE
                    ? "No verifiable excerpt found in retrieved sources."
                    : finalStatus === CONFIG.STATUSES.PARTIALLY_SUPPORTED
                    ? "Evidence supports only partial facets of the claim."
                    : claim.isCompound
                    ? "Compound statement containing multiple sub-assertions requiring separate checks."
                    : null
            ),
            availableEvidenceSummary: item.availableEvidenceSummary || (
                validatedEvidence.length > 0
                    ? `Found ${validatedEvidence.length} validated excerpt(s).`
                    : "No matching excerpts found."
            ),
            missingEvidence: item.missingEvidence || (
                finalStatus === CONFIG.STATUSES.INSUFFICIENT_EVIDENCE
                    ? "Specific factual citation confirming exact figures, dates, or claims."
                    : null
            ),
            recommendedAction: item.recommendedAction || (
                finalStatus === CONFIG.STATUSES.CONTRADICTED
                    ? "Compare conflicting source texts and consult primary regulatory or academic filings."
                    : finalStatus === CONFIG.STATUSES.INSUFFICIENT_EVIDENCE
                    ? "Conduct a targeted search with specific domain keywords."
                    : "Inspect source context to verify nuanced phrasing."
            )
        };
    });

    const summary = {
        supported: verifications.filter((v) => v.status === CONFIG.STATUSES.SUPPORTED).length,
        partiallySupported: verifications.filter((v) => v.status === CONFIG.STATUSES.PARTIALLY_SUPPORTED).length,
        contradicted: verifications.filter((v) => v.status === CONFIG.STATUSES.CONTRADICTED).length,
        insufficientEvidence: verifications.filter((v) => v.status === CONFIG.STATUSES.INSUFFICIENT_EVIDENCE).length
    };

    return {
        totalClaims: verifications.length,
        summary,
        verifications
    };
}
