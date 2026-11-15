import CONFIG from "../config/constants.js";

/**
 * Builds a nuanced, evidence-based trust assessment from claim verifications and source quality.
 * Adheres strictly to the principle that evidence alignment is NOT factual certainty.
 */
export function buildTrustAssessment(verification, sourceDiversity = null, extractedClaims = null) {
    const records = Array.isArray(verification?.verifications) ? verification.verifications : [];
    const validStatuses = [
        CONFIG.STATUSES.SUPPORTED,
        CONFIG.STATUSES.PARTIALLY_SUPPORTED,
        CONFIG.STATUSES.CONTRADICTED,
        CONFIG.STATUSES.INSUFFICIENT_EVIDENCE
    ];
    const hasExpectedClaims = Array.isArray(extractedClaims);
    const expectedClaims = [];
    const expectedById = new Map();
    let invalidExtractedClaims = 0;

    if (hasExpectedClaims) {
        for (const claim of extractedClaims) {
            if (!claim || typeof claim.id !== "string" || !claim.id.trim() ||
                typeof claim.text !== "string" || !claim.text.trim()) {
                invalidExtractedClaims++;
                continue;
            }
            if (expectedById.has(claim.id)) {
                invalidExtractedClaims++;
                continue;
            }
            const normalized = { id: claim.id, text: claim.text.trim() };
            expectedClaims.push(normalized);
            expectedById.set(normalized.id, normalized);
        }
    }

    const seenIds = new Set();
    const results = [];
    let technicalFailures = 0;
    let invalidRecords = 0;

    for (const item of records) {
        if (!item || typeof item.claimId !== "string" || !item.claimId.trim() ||
            typeof item.claim !== "string" || !item.claim.trim()) {
            technicalFailures++;
            invalidRecords++;
            continue;
        }
        if (seenIds.has(item.claimId)) {
            technicalFailures++;
            invalidRecords++;
            continue;
        }
        seenIds.add(item.claimId);

        if (hasExpectedClaims) {
            const expected = expectedById.get(item.claimId);
            if (!expected || expected.text !== item.claim.trim()) {
                technicalFailures++;
                invalidRecords++;
                continue;
            }
        }

        if (item.status === CONFIG.STATUSES.VERIFICATION_ERROR) {
            technicalFailures++;
            continue;
        }
        if (!validStatuses.includes(item.status)) {
            technicalFailures++;
            invalidRecords++;
            continue;
        }
        results.push(item);
    }

    if (hasExpectedClaims) {
        for (const claim of expectedClaims) {
            if (!seenIds.has(claim.id)) technicalFailures++;
        }
    }

    const totalClaims = results.length;
    const expectedClaimCount = hasExpectedClaims ? expectedClaims.length : records.length;
    if (totalClaims === 0) {
        const warnings = ["No valid claim-level factual determinations were available for trust assessment."];
        if (technicalFailures > 0) {
            warnings.push(technicalFailures + " expected claim(s) had technical failures, missing results, or invalid/unmapped verification records; these were excluded from factual metrics.");
        }
        if (invalidExtractedClaims > 0) {
            warnings.push(invalidExtractedClaims + " malformed or duplicate extracted claim(s) were excluded.");
        }
        return {
            assessed: false,
            assessment: technicalFailures > 0 || invalidExtractedClaims > 0 ? "limited" : "unassessed",
            assessmentLabel: technicalFailures > 0 || invalidExtractedClaims > 0 ? "Verification Incomplete / Data Integrity Warning" : "Insufficient Valid Verification Data",
            message: "The system could not calculate a factual evidence-alignment rating because no valid claim determinations were available.",
            dataIntegrityWarning: invalidExtractedClaims > 0 || invalidRecords > 0,
            metrics: {
                totalClaims: 0,
                totalRecords: records.length,
                expectedClaims: expectedClaimCount,
                supported: 0,
                partiallySupported: 0,
                contradicted: 0,
                insufficientEvidence: 0,
                technicalFailures,
                invalidRecords,
                invalidExtractedClaims,
                traceableClaims: 0,
                supportRate: 0,
                partialSupportRate: 0,
                contradictionRate: 0,
                unresolvedRate: 0,
                technicalFailureRate: expectedClaimCount ? Number(((technicalFailures / expectedClaimCount) * 100).toFixed(1)) : 0,
                traceabilityRate: 0
            },
            warnings,
            methodology: getMethodologyDescription(),
            disclaimer: getDisclaimer()
        };
    }

    const supported = results.filter((item) => item.status === CONFIG.STATUSES.SUPPORTED).length;
    const partiallySupported = results.filter((item) => item.status === CONFIG.STATUSES.PARTIALLY_SUPPORTED).length;
    const contradicted = results.filter((item) => item.status === CONFIG.STATUSES.CONTRADICTED).length;
    const insufficientEvidence = results.filter((item) => item.status === CONFIG.STATUSES.INSUFFICIENT_EVIDENCE).length;
    const traceableClaims = results.filter((item) =>
        Array.isArray(item.evidence) && item.evidence.some((entry) =>
            entry && entry.sourceId != null && typeof entry.excerpt === "string" && entry.excerpt.trim().length > 0
        )
    ).length;
    const calcPercentage = (count) => Number(((count / totalClaims) * 100).toFixed(1));
    const supportRate = calcPercentage(supported);
    const partialSupportRate = calcPercentage(partiallySupported);
    const contradictionRate = calcPercentage(contradicted);
    const unresolvedRate = calcPercentage(insufficientEvidence);
    const traceabilityRate = calcPercentage(traceableClaims);
    const technicalFailureRate = expectedClaimCount
        ? Number(((technicalFailures / expectedClaimCount) * 100).toFixed(1))
        : 0;
    const dataIntegrityWarning = invalidRecords > 0 || invalidExtractedClaims > 0;

    let assessment;
    let assessmentLabel;
    if (contradicted > 0) {
        assessment = "contradicted";
        assessmentLabel = "Direct Contradictions Identified";
    } else if (technicalFailures > 0 || dataIntegrityWarning) {
        assessment = "limited";
        assessmentLabel = "Verification Incomplete / Data Integrity Warning";
    } else if (
        supportRate >= 80 &&
        unresolvedRate <= 15 &&
        traceabilityRate >= 80
    ) {
        assessment = "strong";
        assessmentLabel = "Strong Evidence Alignment";
    } else if (
        supportRate + partialSupportRate >= 60 &&
        unresolvedRate <= 35
    ) {
        assessment = "moderate";
        assessmentLabel = "Moderate Evidence Alignment";
    } else {
        assessment = "limited";
        assessmentLabel = "Limited Evidence / Significant Gaps";
    }

    const warnings = [];
    if (contradicted > 0) warnings.push(contradicted + " claim(s) directly conflict with the retrieved web evidence.");
    if (insufficientEvidence > 0) warnings.push(insufficientEvidence + " claim(s) lack sufficient direct excerpt support in the retrieved sources.");
    if (partiallySupported > 0) warnings.push(partiallySupported + " claim(s) have only partial evidence support.");
    if (traceabilityRate < 100) warnings.push((totalClaims - traceableClaims) + " valid claim(s) do not have validated excerpts mapped to sources.");
    const compoundClaimsCount = results.filter((item) => item.isCompound).length;
    if (compoundClaimsCount > 0) warnings.push(compoundClaimsCount + " compound claim(s) contain multiple assertions and warrant separate scrutiny.");
    if (technicalFailures > 0) warnings.push(technicalFailures + " expected claim(s) had technical failures, missing results, or invalid/unmapped records; they were excluded from factual percentages and the overall assessment was capped at limited unless a contradiction was identified.");
    if (invalidExtractedClaims > 0) warnings.push(invalidExtractedClaims + " malformed or duplicate extracted claim(s) were excluded.");
    if (invalidRecords > 0) warnings.push(invalidRecords + " malformed, duplicate, or unmapped verification record(s) were excluded.");
    if (warnings.length === 0) warnings.push("All assessed claims have validated excerpt links and no contradictions were detected.");

    return {
        assessed: true,
        assessment,
        assessmentLabel,
        dataIntegrityWarning,
        metrics: {
            totalClaims,
            totalRecords: records.length,
            expectedClaims: expectedClaimCount,
            supported,
            partiallySupported,
            contradicted,
            insufficientEvidence,
            technicalFailures,
            invalidRecords,
            invalidExtractedClaims,
            traceableClaims,
            supportRate,
            partialSupportRate,
            contradictionRate,
            unresolvedRate,
            technicalFailureRate,
            traceabilityRate
        },
        sourceDiversity: sourceDiversity || null,
        warnings,
        methodology: getMethodologyDescription(),
        disclaimer: getDisclaimer()
    };
}

function getMethodologyDescription() {
    return {
        supportRate: "Percentage of valid claim determinations classified as supported. Technical failures and malformed records are excluded and reported separately.",
        partialSupportRate: "Percentage of claims with partial evidence corroboration.",
        contradictionRate: "Percentage of claims directly refuted by retrieved evidence.",
        unresolvedRate: "Percentage of claims where retrieved sources provide insufficient evidence.",
        traceabilityRate: "Percentage of valid claim determinations with at least one validated excerpt quote linked to a source URL. Technical failures are excluded from this denominator and reported separately."
    };
}

function getDisclaimer() {
    return "This trust assessment measures structural alignment with the specific web sources retrieved during this session. It does NOT represent a mathematical probability of truth, nor does it guarantee factual accuracy or peer-reviewed consensus.";
}

export default { buildTrustAssessment };
