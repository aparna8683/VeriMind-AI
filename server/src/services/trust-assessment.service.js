import CONFIG from "../config/constants.js";

/**
 * Builds a nuanced, evidence-based trust assessment from claim verifications and source quality.
 * Adheres strictly to the principle that evidence alignment is NOT factual certainty.
 */
export function buildTrustAssessment(verification, sourceDiversity = null) {
    const results = verification?.verifications || [];
    const totalClaims = results.length;

    if (totalClaims === 0) {
        return {
            assessed: false,
            assessment: "unassessed",
            assessmentLabel: "No Claims Assessed",
            message: "No verifiable factual claims were extracted from the answer.",
            metrics: {
                totalClaims: 0,
                supported: 0,
                partiallySupported: 0,
                contradicted: 0,
                insufficientEvidence: 0,
                traceableClaims: 0,
                supportRate: 0,
                partialSupportRate: 0,
                contradictionRate: 0,
                unresolvedRate: 0,
                traceabilityRate: 0
            },
            warnings: ["No checkable factual claims could be identified in the generated response."],
            methodology: getMethodologyDescription(),
            disclaimer: getDisclaimer()
        };
    }

    const supported = results.filter((item) => item.status === CONFIG.STATUSES.SUPPORTED).length;
    const partiallySupported = results.filter((item) => item.status === CONFIG.STATUSES.PARTIALLY_SUPPORTED).length;
    const contradicted = results.filter((item) => item.status === CONFIG.STATUSES.CONTRADICTED).length;
    const insufficientEvidence = results.filter((item) => item.status === CONFIG.STATUSES.INSUFFICIENT_EVIDENCE).length;

    const traceableClaims = results.filter(
        (item) => Array.isArray(item.evidence) && item.evidence.length > 0
    ).length;

    const calcPercentage = (count) => Number(((count / totalClaims) * 100).toFixed(1));

    const supportRate = calcPercentage(supported);
    const partialSupportRate = calcPercentage(partiallySupported);
    const contradictionRate = calcPercentage(contradicted);
    const unresolvedRate = calcPercentage(insufficientEvidence);
    const traceabilityRate = calcPercentage(traceableClaims);

    // Multi-factor classification
    let assessment;
    let assessmentLabel;

    if (contradicted > 0) {
        assessment = "contradicted";
        assessmentLabel = "Direct Contradictions Identified";
    } else if (
        supportRate >= 80 &&
        contradictionRate === 0 &&
        unresolvedRate <= 15 &&
        traceabilityRate >= 80
    ) {
        assessment = "strong";
        assessmentLabel = "Strong Evidence Alignment";
    } else if (
        supportRate + partialSupportRate >= 60 &&
        contradictionRate === 0 &&
        unresolvedRate <= 35
    ) {
        assessment = "moderate";
        assessmentLabel = "Moderate Evidence Alignment";
    } else {
        assessment = "limited";
        assessmentLabel = "Limited Evidence / Significant Gaps";
    }

    const warnings = [];

    if (contradicted > 0) {
        warnings.push(`${contradicted} claim(s) directly conflict with the retrieved web evidence.`);
    }

    if (insufficientEvidence > 0) {
        warnings.push(`${insufficientEvidence} claim(s) lack verifiable direct excerpt support in the retrieved sources.`);
    }

    if (partiallySupported > 0) {
        warnings.push(`${partiallySupported} claim(s) are partially supported, but certain sub-assertions remain uncorroborated.`);
    }

    if (traceabilityRate < 100) {
        warnings.push(`${totalClaims - traceableClaims} claim(s) do not have verbatim excerpt quotes mapped to sources.`);
    }

    const compoundClaimsCount = results.filter((r) => r.isCompound).length;
    if (compoundClaimsCount > 0) {
        warnings.push(`${compoundClaimsCount} compound claim(s) combine multiple assertions and warrant separate scrutiny.`);
    }

    if (warnings.length === 0) {
        warnings.push("All identified claims match validated excerpts in retrieved evidence with zero detected contradictions.");
    }

    return {
        assessed: true,
        assessment,
        assessmentLabel,
        metrics: {
            totalClaims,
            supported,
            partiallySupported,
            contradicted,
            insufficientEvidence,
            traceableClaims,
            supportRate,
            partialSupportRate,
            contradictionRate,
            unresolvedRate,
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
        supportRate: "Percentage of claims directly corroborated by verbatim excerpts in retrieved sources.",
        partialSupportRate: "Percentage of claims with partial evidence corroboration.",
        contradictionRate: "Percentage of claims directly refuted by retrieved evidence.",
        unresolvedRate: "Percentage of claims where retrieved sources provide insufficient evidence.",
        traceabilityRate: "Percentage of claims with at least one validated excerpt quote linked to a source URL."
    };
}

function getDisclaimer() {
    return "This trust assessment measures structural alignment with the specific web sources retrieved during this session. It does NOT represent a mathematical probability of truth, nor does it guarantee factual accuracy or peer-reviewed consensus.";
}

export default { buildTrustAssessment };
