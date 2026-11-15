import { generateJsonWithGroq } from "../providers/groq.provider.js";
import CONFIG from "../config/constants.js";

const VALID_STATUSES = [
    CONFIG.STATUSES.SUPPORTED,
    CONFIG.STATUSES.PARTIALLY_SUPPORTED,
    CONFIG.STATUSES.CONTRADICTED,
    CONFIG.STATUSES.INSUFFICIENT_EVIDENCE
];
const STOP_WORDS = new Set(["the","and","for","that","with","from","this","these","those","was","were","are","is","has","have","had","will","can","could","should","would","into","than","then","their","they","them","about","which","what","when","where","how","why","who","also","more","most","some","many","such","over","under","between","among","through","based","using","used","including","according"]);
const tokenize = (value) => (typeof value === "string" ? value : "").toLowerCase().match(/[a-z0-9]{3,}/g) || [];
export function selectSourcesForClaim(claim, sources, limit = CONFIG.MAX_EVIDENCE_SOURCES_PER_CLAIM || 3) {
    const terms = [...new Set(tokenize(claim?.text).filter((word) => !STOP_WORDS.has(word)))];
    const ranked = sources.map((source) => {
        const titleTokens = new Set(tokenize(source.title));
        const contentTokens = new Set(tokenize(source.content));
        const score = terms.reduce((total, term) => {
            const documentFrequency = sources.filter((candidate) => tokenize((candidate.title || "") + " " + (candidate.content || "")).includes(term)).length;
            const specificity = Math.log(1 + sources.length / Math.max(1, documentFrequency));
            return total + (titleTokens.has(term) ? 3 : contentTokens.has(term) ? 1 : 0) * specificity;
        }, 0);
        return { source, score };
    }).sort((a, b) => b.score - a.score);
    const lexicalMatches = ranked.filter((entry) => entry.score > 0);
    if (lexicalMatches.length) return lexicalMatches.slice(0, limit).map((entry) => entry.source);
    return ranked.filter((entry) => Number.isFinite(entry.source.score) && entry.source.score > 0).sort((a, b) => b.source.score - a.source.score).slice(0, limit).map((entry) => entry.source);
}
function isAbsenceAssertion(text) {
    return /(?:\b(?:doesn\x27t|does not|didn\x27t|did not|fails? to|without)\s+(?:mention|provide|report|include|contain|offer)\b|\bno\s+(?:(?:direct|comparative|relevant)\s+)*(?:data|evidence|information|reporting|comparison)\b|\babsence of\s+(?:data|evidence|information)\b)/i.test(text || "");
}

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
export function isExcerptInSource(excerpt, sourceContent) {
    if (typeof excerpt !== "string" || typeof sourceContent !== "string") return false;
    const normExcerpt = normalizeText(excerpt);
    const normSource = normalizeText(sourceContent);
    // Do not accept matching fragments from opposite ends of a quotation:
    // the complete normalized excerpt must occur in the source.
    return normExcerpt.length >= 10 && normSource.includes(normExcerpt);
}

function buildVerificationFailure(claim, code, message) {
    return {
        claimId: claim.id,
        claim: claim.text,
        status: CONFIG.STATUSES.VERIFICATION_ERROR,
        rationale: "The verification process did not produce a valid structured determination. This is a technical failure, not evidence that the claim is true or false.",
        evidence: [],
        assertionResults: [],
        isCompound: Boolean(claim.isCompound),
        subAssertions: claim.subAssertions || [],
        reviewNeeded: true,
        reviewReason: "Verification failed before a reliable factual determination could be made.",
        availableEvidenceSummary: "No validated assertion-level determination is available.",
        missingEvidence: null,
        recommendedAction: "Retry verification or inspect the retrieved sources manually.",
        verificationError: { code, message }
    };
}

function validateEvidenceEntries(entries, sourceMap, maxEvidence, allowedSourceIds = null) {
    const validated = [];
    const seen = new Set();
    for (const entry of Array.isArray(entries) ? entries : []) {
        if (!entry || typeof entry.excerpt !== "string") continue;
        const source = sourceMap.get(String(entry.sourceId));
        if (!source || (allowedSourceIds && !allowedSourceIds.has(source.id)) || !isExcerptInSource(entry.excerpt, source.content)) continue;
        const key = String(entry.sourceId) + ":" + normalizeText(entry.excerpt);
        if (seen.has(key)) continue;
        seen.add(key);
        validated.push({
            sourceId: source.id,
            sourceTitle: source.title,
            url: source.url,
            excerpt: entry.excerpt.trim()
        });
        if (validated.length >= maxEvidence) break;
    }
    return validated;
}

export function buildFinalRationale(status, evidenceCount) {
    const countText = evidenceCount === 1
        ? "One excerpt passed verbatim source-text validation."
        : evidenceCount + " excerpts passed verbatim source-text validation.";
    if (status === CONFIG.STATUSES.SUPPORTED) {
        return "The verifier classified this claim as supported. " + countText + " Exact-text matching confirms that the quotation occurs in the retrieved source; it does not independently prove that it entails every part of the claim.";
    }
    if (status === CONFIG.STATUSES.PARTIALLY_SUPPORTED) {
        return "The verifier classified this claim as partially supported. " + countText + " At least one material element remains unestablished by the supplied evidence.";
    }
    if (status === CONFIG.STATUSES.CONTRADICTED) {
        return "The verifier classified this claim as contradicted. " + countText + " Review the quoted source context before relying on this determination.";
    }
    return evidenceCount > 0
        ? "The retrieved excerpts were text-validated, but the verifier did not find them sufficient to establish or refute this claim. " + countText
        : "No model-provided excerpt passed verbatim validation against the retrieved source text. No factual determination can be made from the validated excerpts.";
}

function deriveAssertionStatus(assertions) {
    const statuses = assertions.map((item) => item.status);
    if (statuses.includes(CONFIG.STATUSES.CONTRADICTED)) return CONFIG.STATUSES.CONTRADICTED;
    if (statuses.length && statuses.every((status) => status === CONFIG.STATUSES.SUPPORTED)) return CONFIG.STATUSES.SUPPORTED;
    if (statuses.length && statuses.every((status) => status === CONFIG.STATUSES.INSUFFICIENT_EVIDENCE)) return CONFIG.STATUSES.INSUFFICIENT_EVIDENCE;
    if (statuses.some((status) => status === CONFIG.STATUSES.SUPPORTED || status === CONFIG.STATUSES.PARTIALLY_SUPPORTED)) return CONFIG.STATUSES.PARTIALLY_SUPPORTED;
    return CONFIG.STATUSES.INSUFFICIENT_EVIDENCE;
}

export function normalizeVerificationItem(claim, item, sources = [], allowedSourceIds = null) {
    if (!claim || typeof claim.id !== "string" || !claim.id.trim() ||
        typeof claim.text !== "string" || !claim.text.trim()) {
        return buildVerificationFailure(claim || { id: null, text: "" }, "INVALID_CLAIM_INPUT", "The extracted claim is missing a stable ID or non-empty text.");
    }
    if (!item || !VALID_STATUSES.includes(item.status)) {
        return buildVerificationFailure(claim, "INVALID_MODEL_RESULT", "The verifier did not return a recognized status for this claim.");
    }

    const sourceMap = new Map((Array.isArray(sources) ? sources : [])
        .filter((source) => source && source.id != null)
        .map((source) => [String(source.id), source]));
    const maxEvidence = CONFIG.MAX_EVIDENCE_SOURCES_PER_CLAIM || 3;
    const validatedEvidence = validateEvidenceEntries(item.evidence, sourceMap, maxEvidence, allowedSourceIds);
    const assertionResults = [];

    if (claim.isCompound && (!Array.isArray(claim.subAssertions) || claim.subAssertions.length === 0)) {
        return buildVerificationFailure(claim, "COMPOUND_ASSERTIONS_MISSING", "The extracted compound claim did not contain separate assertions to verify.");
    }
    if (claim.isCompound && (!Array.isArray(item.assertionResults) || item.assertionResults.length !== claim.subAssertions.length)) {
        return buildVerificationFailure(claim, "ASSERTION_RESULTS_MISSING", "The verifier did not return one assertion-level result for every extracted sub-assertion.");
    }
    if (claim.isCompound) {
        const expected = new Set(claim.subAssertions.map((assertion) => normalizeText(assertion)));
        const returned = item.assertionResults.map((assertion) => normalizeText(assertion?.assertion ?? assertion?.text));
        if (new Set(returned).size !== expected.size || returned.some((assertion) => !expected.has(assertion))) {
            return buildVerificationFailure(claim, "ASSERTION_IDENTITY_MISMATCH", "The verifier did not return each extracted sub-assertion exactly once.");
        }
    }

    if (Array.isArray(item.assertionResults)) {
        for (const assertion of item.assertionResults) {
            const assertionText = assertion?.assertion ?? assertion?.text;
            if (typeof assertionText !== "string" || !assertionText.trim() || !VALID_STATUSES.includes(assertion?.status)) {
                return buildVerificationFailure(claim, "INVALID_ASSERTION_RESULT", "An assertion-level result was missing its text or had an invalid status.");
            }
            if (claim.isCompound && !claim.subAssertions.some((expected) => normalizeText(expected) === normalizeText(assertionText))) {
                return buildVerificationFailure(claim, "ASSERTION_IDENTITY_MISMATCH", "An assertion-level result did not match an extracted sub-assertion.");
            }
            const assertionEvidence = validateEvidenceEntries(assertion.evidence, sourceMap, maxEvidence, allowedSourceIds);
            let assertionStatus = assertion.status !== CONFIG.STATUSES.INSUFFICIENT_EVIDENCE && assertionEvidence.length === 0
                ? CONFIG.STATUSES.INSUFFICIENT_EVIDENCE
                : assertion.status;
            if (isAbsenceAssertion(assertionText) && assertionStatus === CONFIG.STATUSES.SUPPORTED && assertion.evidenceState !== "source_explicitly_states_absence") assertionStatus = CONFIG.STATUSES.INSUFFICIENT_EVIDENCE;
            assertionResults.push({
                assertion: assertionText.trim(),
                status: assertionStatus,
                evidence: assertionEvidence,
                evidenceState: isAbsenceAssertion(assertionText) && assertionStatus === CONFIG.STATUSES.INSUFFICIENT_EVIDENCE ? "not_found_in_retrieved_excerpts" : assertion.evidenceState === "source_explicitly_states_absence" && assertionEvidence.length > 0 ? "source_explicitly_states_absence" : assertionEvidence.length > 0 ? "validated_excerpt_found" : "not_found_in_retrieved_excerpts",
                rationale: buildFinalRationale(assertionStatus, assertionEvidence.length)
            });
        }
    }

    const evidenceByKey = new Map();
    for (const entry of [...validatedEvidence, ...assertionResults.flatMap((assertion) => assertion.evidence)]) {
        const key = String(entry.sourceId) + ":" + normalizeText(entry.excerpt);
        if (!evidenceByKey.has(key)) evidenceByKey.set(key, entry);
    }
    const finalEvidence = [...evidenceByKey.values()].slice(0, maxEvidence);

    let finalStatus = assertionResults.length > 0
        ? deriveAssertionStatus(assertionResults)
        : item.status;
    if (finalStatus !== CONFIG.STATUSES.INSUFFICIENT_EVIDENCE && finalEvidence.length === 0) {
        finalStatus = CONFIG.STATUSES.INSUFFICIENT_EVIDENCE;
    }
    if (!claim.isCompound && isAbsenceAssertion(claim.text) && finalStatus === CONFIG.STATUSES.SUPPORTED && item.evidenceState !== "source_explicitly_states_absence") finalStatus = CONFIG.STATUSES.INSUFFICIENT_EVIDENCE;

    const isFlagged =
        finalStatus === CONFIG.STATUSES.CONTRADICTED ||
        finalStatus === CONFIG.STATUSES.INSUFFICIENT_EVIDENCE ||
        finalStatus === CONFIG.STATUSES.PARTIALLY_SUPPORTED ||
        Boolean(claim.isCompound);

    return {
        claimId: claim.id,
        claim: claim.text.trim(),
        status: finalStatus,
        rationale: buildFinalRationale(finalStatus, finalEvidence.length),
        evidence: finalEvidence,
        assertionResults,
        isCompound: Boolean(claim.isCompound),
        subAssertions: Array.isArray(claim.subAssertions) ? claim.subAssertions : [],
        reviewNeeded: isFlagged,
        reviewReason: finalStatus === CONFIG.STATUSES.CONTRADICTED
            ? "The verifier identified evidence it classified as directly conflicting with the claim."
            : finalStatus === CONFIG.STATUSES.INSUFFICIENT_EVIDENCE
            ? "The retrieved evidence does not establish or refute every material element of this claim."
            : finalStatus === CONFIG.STATUSES.PARTIALLY_SUPPORTED
            ? "Only part of the claim is established by the retrieved evidence."
            : claim.isCompound
            ? "Compound statement containing multiple assertions requiring separate checks."
            : null,
        availableEvidenceSummary: finalEvidence.length > 0
            ? finalEvidence.length + " excerpt(s) matched the retrieved source text. Text matching does not independently establish factual entailment."
            : "No model-provided excerpt passed verbatim validation against the retrieved source text.",
        missingEvidence: finalStatus === CONFIG.STATUSES.INSUFFICIENT_EVIDENCE
            ? (finalEvidence.length > 0
                ? "A source passage that directly establishes the unresolved factual element(s)."
                : "A source passage that directly establishes or contradicts the claim.")
            : finalStatus === CONFIG.STATUSES.PARTIALLY_SUPPORTED
            ? "Direct evidence for the remaining material assertion(s)."
            : null,
        recommendedAction: finalStatus === CONFIG.STATUSES.INSUFFICIENT_EVIDENCE
            ? "Run a focused search for the unresolved factual elements and prefer primary sources."
            : finalStatus === CONFIG.STATUSES.PARTIALLY_SUPPORTED
            ? "Separate the claim into atomic assertions and verify each one independently."
            : finalStatus === CONFIG.STATUSES.CONTRADICTED
            ? "Inspect the conflicting excerpt and its surrounding source context."
            : "Inspect source context if the claim is material to the final conclusion.",
        verificationError: null
    };
}

/**
 * Verifies extracted claims against retrieved web evidence.
 * Batches claims to stay within LLM token limits and validates all returned excerpts.
 */
export async function verifyClaims(claims, sources, { generateJson = generateJsonWithGroq } = {}) {
    if (!Array.isArray(claims) || claims.length === 0) {
        return {
            totalClaims: 0,
            summary: {
                supported: 0,
                partiallySupported: 0,
                contradicted: 0,
                insufficientEvidence: 0,
                technicalFailures: 0
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
                insufficientEvidence: claims.length,
                technicalFailures: 0
            },
            verifications: claims.map((c) => ({
                claimId: c.id,
                claim: c.text,
                status: CONFIG.STATUSES.INSUFFICIENT_EVIDENCE,
                rationale: "No retrieved web sources were available for verification.",
                evidence: [],
                assertionResults: Array.isArray(c.subAssertions) ? c.subAssertions.map((assertion) => ({
                    assertion,
                    status: CONFIG.STATUSES.INSUFFICIENT_EVIDENCE,
                    evidence: [],
                    evidenceState: "not_found_in_retrieved_excerpts"
                })) : [],
                isCompound: Boolean(c.isCompound),
                subAssertions: Array.isArray(c.subAssertions) ? c.subAssertions : [],
                reviewNeeded: true,
                reviewReason: "Absence of retrieved reference sources.",
                availableEvidenceSummary: "No sources retrieved.",
                missingEvidence: "Primary or secondary source documentation.",
                recommendedAction: "Perform a web search targeting this claim."
            }))
        };
    }

    const sourceMap = new Map(sources.map((s) => [s.id, s]));

    // Keep prompts bounded and isolate each claim to its own selected source IDs.
    const batchSize = 2;
    const allResults = [];
    const allowedSourceIdsByClaim = new Map();

    for (let i = 0; i < claims.length; i += batchSize) {
        const batch = claims.slice(i, i + batchSize);
        const relevantSources = new Map();

        for (const claim of batch) {
            const selectedForClaim = selectSourcesForClaim(claim, sources);
            allowedSourceIdsByClaim.set(claim.id, new Set(selectedForClaim.map((source) => source.id)));
            for (const source of selectedForClaim) relevantSources.set(source.id, source);
        }

        const selectedSources = [...relevantSources.values()];
        const evidenceForModel = selectedSources.map((s) => ({
            id: s.id,
            title: s.title,
            url: s.url,
            content: (s.content || "").slice(0, 1100)
        }));

        const prompt = `
You are the Claim Verification Agent for VeriMind AI.

Evaluate each claim using ONLY its allowed source IDs in the supplied web evidence. Do not use outside knowledge.
For claims that say a source does not mention or provide something, an excerpt that merely omits it is NOT proof.
Use evidenceState "not_found_in_retrieved_excerpts" when absent from these excerpts. Only use
"source_explicitly_states_absence" when the source itself explicitly states the absence and you quote that text.
Never imply a complete source was checked when only an excerpt was supplied.

CLAIMS:
${JSON.stringify(batch.map((claim) => ({ ...claim, allowedSourceIds: [...(allowedSourceIdsByClaim.get(claim.id) || [])] })))}

EVIDENCE:
${JSON.stringify(evidenceForModel)}

RULES:
- "supported" means every material factual element is explicitly confirmed.
- "partially_supported" means only some elements are confirmed.
- "contradicted" means a source directly conflicts with the claim.
- "insufficient_evidence" means the supplied text does not prove or disprove it.
- Related keywords or a source discussing the same topic are not proof.
- Every evidence excerpt must be a verbatim passage copied from the supplied source content.
- Return sourceId values only from the claim allowedSourceIds.
- Positive support and contradiction require a directly relevant verbatim excerpt.
- Do not infer source-wide absence from this retrieved excerpt set.
- If the source itself explicitly states that information is absent, quote that exact passage and set evidenceState to "source_explicitly_states_absence".
- If the supplied excerpt set does not contain the information, set evidenceState to "not_found_in_retrieved_excerpts".
- If there are no relevant sources or no direct quotation, use insufficient_evidence.
- Keep rationale concise (one or two sentences).
- For every compound claim, return one assertionResults item for each supplied subAssertion, preserving its exact text.
- Each assertionResults item must have its own status and verbatim evidence excerpts.
- Do not use claim-level evidence to imply that every sub-assertion is supported.
- For non-compound claims, assertionResults may be an empty array.
- Provide reviewReason, availableEvidenceSummary, missingEvidence, and recommendedAction for every claim.

Return ONLY this JSON object:
{
  "verifications": [
    {
      "claimId": "C1",
      "status": "supported",
      "rationale": "Concise evidence-based explanation.",
      "evidence": [{"sourceId": 1, "excerpt": "Exact source quotation."}],
      "assertionResults": [
        {
          "assertion": "Exact sub-assertion text.",
          "status": "supported",
          "evidence": [{"sourceId": 1, "excerpt": "Exact source quotation."}],
          "evidenceState": "explicitly_stated"
        }
      ],
      "reviewNeeded": false,
      "reviewReason": null,
      "availableEvidenceSummary": "What the source establishes.",
      "missingEvidence": null,
      "recommendedAction": "No further action."
    }
  ]
}
`;

        if (selectedSources.length === 0) {
            allResults.push(...batch.map((claim) => ({
                claimId: claim.id,
                status: CONFIG.STATUSES.INSUFFICIENT_EVIDENCE,
                rationale: "No retrieved source contained relevant terms for this claim.",
                evidence: [],
                assertionResults: Array.isArray(claim.subAssertions) ? claim.subAssertions.map((assertion) => ({
                    assertion,
                    status: CONFIG.STATUSES.INSUFFICIENT_EVIDENCE,
                    evidence: [],
                    evidenceState: "not_found_in_retrieved_excerpts"
                })) : [],
                isCompound: Boolean(claim.isCompound),
                subAssertions: Array.isArray(claim.subAssertions) ? claim.subAssertions : [],
                reviewNeeded: true,
                reviewReason: "No relevant source was selected.",
                availableEvidenceSummary: "No relevant evidence found in the retrieved source set.",
                missingEvidence: "A source that directly addresses this claim.",
                recommendedAction: "Run a focused search for this exact claim."
            })));
            continue;
        }

        try {
            const result = await generateJson(prompt);
            if (result && Array.isArray(result.verifications)) {
                allResults.push(...result.verifications);
            } else {
                allResults.push(...batch.map((claim) => ({
                    claimId: claim.id,
                    __verificationError: { code: "INVALID_MODEL_RESPONSE", message: "The model response did not contain a verifications array." }
                })));
            }
        } catch (error) {
            const safeMessage = error?.code || error?.name || "Provider request failed";
            allResults.push(...batch.map((claim) => ({
                claimId: claim.id,
                __verificationError: { code: "VERIFICATION_PROVIDER_FAILED", message: safeMessage }
            })));
        }
    }

    const verificationMap = new Map();
    const resultCounts = new Map();
    for (const item of allResults) {
        if (item?.claimId == null) continue;
        const id = String(item.claimId);
        resultCounts.set(id, (resultCounts.get(id) || 0) + 1);
        verificationMap.set(id, item);
    }

    const verifications = claims.map((claim) => {
        const item = verificationMap.get(String(claim.id));
        if ((resultCounts.get(String(claim.id)) || 0) > 1) {
            return buildVerificationFailure(claim, "DUPLICATE_MODEL_RESULT", "The model returned more than one verification record for this claim.");
        }
        if (item?.__verificationError) {
            return buildVerificationFailure(claim, item.__verificationError.code, item.__verificationError.message);
        }
        return normalizeVerificationItem(claim, item, sources, allowedSourceIdsByClaim.get(claim.id) || new Set());
    });

    const summary = {
        supported: verifications.filter((v) => v.status === CONFIG.STATUSES.SUPPORTED).length,
        partiallySupported: verifications.filter((v) => v.status === CONFIG.STATUSES.PARTIALLY_SUPPORTED).length,
        contradicted: verifications.filter((v) => v.status === CONFIG.STATUSES.CONTRADICTED).length,
        insufficientEvidence: verifications.filter((v) => v.status === CONFIG.STATUSES.INSUFFICIENT_EVIDENCE).length,
        technicalFailures: verifications.filter((v) => v.status === CONFIG.STATUSES.VERIFICATION_ERROR).length
    };

    return {
        totalClaims: verifications.length,
        summary,
        verifications
    };
}
