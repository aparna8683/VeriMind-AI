const VALID_RESULT_STATUSES = new Set([
    "supported",
    "partially_supported",
    "contradicted",
    "insufficient_evidence"
]);

/** Merge a re-verification only when its identity and result contract are valid. */
export function applyReverificationResult(previousResults, claimId, claimText, response) {
    const rows = Array.isArray(previousResults) ? previousResults : [];
    const verification = response?.verification;
    const succeeded = response?.success === true && response?.attempt?.status === "succeeded" &&
        verification?.claimId === claimId &&
        verification?.claim === claimText &&
        VALID_RESULT_STATUSES.has(verification?.status);
    let updated = false;

    const verifications = rows.map((previous) => {
        if (previous.claimId !== claimId) return previous;
        updated = true;
        if (succeeded) {
            return {
                ...verification,
                reverified: true,
                originalStatus: previous.status,
                statusChanged: previous.status !== verification.status,
                reverificationAttempt: { status: "succeeded", timestamp: new Date().toISOString() }
            };
        }
        return {
            ...previous,
            reverificationAttempt: {
                status: "failed",
                code: response?.attempt?.code || verification?.verificationError?.code || "INVALID_REVERIFICATION_RESULT",
                message: response?.attempt?.message || "No valid re-verification result was returned; the previous result was kept.",
                timestamp: new Date().toISOString()
            }
        };
    });

    return { verifications, succeeded: succeeded && updated, updated };
}
