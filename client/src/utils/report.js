/** Normalize current and older locally stored report shapes at the UI boundary. */
export function normalizeResearchReport(report) {
    if (!report || typeof report !== "object") return report;
    const extracted = Array.isArray(report.claims?.claims)
        ? report.claims.claims
        : Array.isArray(report.claims) ? report.claims : [];
    const claimById = new Map(extracted
        .filter((claim) => (claim?.id ?? claim?.claimId) != null)
        .map((claim) => [claim.id ?? claim.claimId, claim.text ?? claim.claim]));
    const oldVerifications = Array.isArray(report.verification?.verifications)
        ? report.verification.verifications
        : Array.isArray(report.verification) ? report.verification
            : Array.isArray(report.verifications) ? report.verifications : [];
    const integrityIssues = [];
    const unmappedVerifications = [];
    const seenIds = new Set();
    const validStatuses = new Set(["supported", "partially_supported", "contradicted", "insufficient_evidence", "verification_error"]);
    const canAlignByPosition = extracted.length === oldVerifications.length;
    const verifications = [];
    oldVerifications.forEach((item, index) => {
        const positionalClaim = canAlignByPosition ? extracted[index] : null;
        const positionalId = positionalClaim?.id ?? positionalClaim?.claimId;
        const hasStableClaimId = item?.claimId && !/^legacy-\d+$/.test(String(item.claimId));
        const expectedText = hasStableClaimId ? claimById.get(item.claimId) : undefined;
        const positionalText = positionalClaim?.text ?? positionalClaim?.claim;
        const sourceText = typeof item?.claim === "string" && item.claim.trim() ? item.claim.trim() : undefined;
        const claimId = hasStableClaimId ? item.claimId : positionalId;
        const claimText = sourceText || expectedText || (!hasStableClaimId ? positionalText : undefined);

        let unmappedReason = null;
        if (!claimId || !claimText || !String(claimText).trim()) unmappedReason = "Missing claim identity or claim text.";
        else if (hasStableClaimId && extracted.length > 0 && expectedText === undefined) unmappedReason = "Claim ID does not map to an extracted claim.";
        else if (expectedText && sourceText && expectedText.trim() !== sourceText) unmappedReason = "Verification text does not match the extracted claim for this ID.";
        else if (!hasStableClaimId && positionalText && sourceText && String(positionalText).trim() !== sourceText) unmappedReason = "Legacy verification text does not match the claim at this position.";
        else if (!hasStableClaimId && !positionalClaim && extracted.length > 0) unmappedReason = "Legacy row cannot be aligned to an extracted claim.";
        else if (seenIds.has(claimId)) unmappedReason = "Duplicate verification record for this claim ID.";

        if (unmappedReason) {
            integrityIssues.push(`Verification ${item?.claimId || index + 1}: ${unmappedReason}`);
            unmappedVerifications.push({ recordIndex: index, claimId: item?.claimId || null, reason: unmappedReason, record: item });
            return;
        }

        seenIds.add(claimId);
        const hasValidStatus = validStatuses.has(item?.status);
        if (!hasValidStatus) integrityIssues.push(`Verification ${claimId} had an invalid status and was marked as a technical failure.`);
        verifications.push({
            ...item,
            claim: String(claimText).trim(),
            claimId,
            status: hasValidStatus ? item.status : "verification_error",
            verificationError: hasValidStatus ? item?.verificationError : { code: "INVALID_HISTORICAL_STATUS", message: "The saved verification status was invalid." },
            reviewNeeded: item?.reviewNeeded === true || !hasValidStatus,
            rationale: typeof item?.rationale === "string" ? item.rationale : "",
            evidence: Array.isArray(item?.evidence) ? item.evidence : [],
            subAssertions: Array.isArray(item?.subAssertions) ? item.subAssertions : []
        });
    });
    const normalizedReport = { ...report };
    delete normalizedReport.verifications;
    return {
        ...normalizedReport,
        sources: Array.isArray(report.sources) ? report.sources : [],
        verification: {
            ...(report.verification && !Array.isArray(report.verification) ? report.verification : {}),
            verifications
        },
        dataIntegrityIssues: integrityIssues,
        unmappedVerifications
    };
}
