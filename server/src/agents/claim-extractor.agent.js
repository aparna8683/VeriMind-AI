import { generateJsonWithGroq } from "../providers/groq.provider.js";
import CONFIG from "../config/constants.js";

/**
 * Extracts atomic, checkable factual claims from the research answer.
 * Also flags compound statements containing multiple distinct assertions.
 */
export async function extractClaims(answer, sources = [], { generateJson = generateJsonWithGroq } = {}) {
    if (!answer || typeof answer !== "string") {
        throw new Error("A valid answer is required for claim extraction");
    }

    const validSourceIds = sources.map((source) => source.id);
    const maxClaims = CONFIG.MAX_CLAIMS_PER_RESEARCH || 10;

    const prompt = `
You are the Claim Extraction Agent for VeriMind AI.

Your task is to extract atomic, checkable factual claims from the answer.

ANSWER:
${answer}

AVAILABLE SOURCE IDs:
${JSON.stringify(validSourceIds)}

RULES:
1. Extract only factual claims that can be objectively checked against evidence (dates, quantities, events, mechanisms, findings, legal acts).
2. Each claim must express one specific factual statement.
3. Exclude subjective opinions, questions, speculative advice, and generic introductory remarks.
4. If a statement combines multiple independent facts (e.g. "X occurred in 2023 AND increased revenue by 40%"), extract it and mark "isCompound": true with "subAssertions".
5. Make each subAssertion one independently checkable factual statement, including distinct study design, population, duration, and outcome details where present.
6. Preserve original meaning. Do not introduce new facts.
7. Capture cited source IDs if mentioned as [1], [2], etc.
8. Only include source IDs that exist in AVAILABLE SOURCE IDs.
9. Avoid duplicate claims.
10. Return at most ${maxClaims} of the most critical factual claims.
11. Return an empty claims array if no factual claims exist.

Return JSON in exactly this structure:
{
    "claims": [
        {
            "id": "C1",
            "text": "A single checkable factual statement.",
            "citedSourceIds": [1],
            "isCompound": false,
            "subAssertions": []
        }
    ]
}
`;

    const result = await generateJson(prompt);

    if (!result || !Array.isArray(result.claims)) {
        throw new Error("Invalid claim extraction response structure from LLM");
    }

    const claims = result.claims
        .filter((claim) =>
            claim &&
            typeof claim.text === "string" &&
            claim.text.trim().length > 0
        )
        .map((claim, index) => ({
            id: `C${index + 1}`,
            text: claim.text.trim(),
            citedSourceIds: Array.isArray(claim.citedSourceIds)
                ? claim.citedSourceIds.filter((id) => validSourceIds.includes(id))
                : [],
            isCompound: Boolean(claim.isCompound),
            subAssertions: Array.isArray(claim.subAssertions) ? claim.subAssertions : []
        }))
        .slice(0, maxClaims);

    return {
        totalClaims: claims.length,
        claims
    };
}
