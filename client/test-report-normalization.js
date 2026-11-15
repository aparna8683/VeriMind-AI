import assert from "node:assert/strict";
import { normalizeResearchReport } from "./src/utils/report.js";
import { applyReverificationResult } from "./src/utils/reverification.js";

const legacy = normalizeResearchReport({
    claims: { claims: [{ id: "C1", text: "Recovered from the old claim list" }] },
    verifications: [
        { claimId: "C1", status: "insufficient_evidence" },
        { claimId: "C2", status: "unsupported-status", claim: "  " }
    ]
});

assert.equal(legacy.verification.verifications[0].claim, "Recovered from the old claim list");
assert.deepEqual(legacy.verification.verifications[0].evidence, []);
assert.equal(legacy.verification.verifications.length, 1);
assert.equal(legacy.unmappedVerifications.length, 1);
assert.equal(legacy.unmappedVerifications[0].claimId, "C2");
assert.equal(legacy.dataIntegrityIssues.length, 1);

const alignedLegacy = normalizeResearchReport({
    claims: { claims: [
        { id: "C1", text: "First extracted claim" },
        { id: "C2", text: "Last extracted claim" }
    ] },
    verification: { verifications: [
        { claimId: "legacy-1", claim: "", status: "insufficient_evidence" },
        { claimId: "legacy-2", claim: "", status: "insufficient_evidence" }
    ] }
});
assert.deepEqual(alignedLegacy.verification.verifications.map((item) => [item.claimId, item.claim]), [
    ["C1", "First extracted claim"],
    ["C2", "Last extracted claim"]
]);
assert.deepEqual(alignedLegacy.dataIntegrityIssues, []);

const invalidStatus = normalizeResearchReport({
    claims: { claims: [{ id: "C1", text: "A real extracted claim" }] },
    verification: { verifications: [{ claimId: "C1", status: "unknown_status" }] }
});
assert.equal(invalidStatus.verification.verifications[0].claim, "A real extracted claim");
assert.equal(invalidStatus.verification.verifications[0].status, "verification_error");

const previousSuccessful = {
    claimId: "C1",
    claim: "A real extracted claim",
    status: "supported",
    evidence: [{ sourceId: 1, excerpt: "Previously validated evidence." }],
    reverified: true
};
const failedRetry = applyReverificationResult([previousSuccessful], "C1", previousSuccessful.claim, {
    success: true,
    verification: null,
    attempt: { status: "failed", code: "MALFORMED_MODEL_JSON", message: "Retry failed." }
});
assert.equal(failedRetry.succeeded, false);
assert.equal(failedRetry.verifications[0].status, "supported");
assert.deepEqual(failedRetry.verifications[0].evidence, previousSuccessful.evidence);
assert.equal(failedRetry.verifications[0].reverificationAttempt.status, "failed");

const successfulRetry = applyReverificationResult([{
    claimId: "C1", claim: previousSuccessful.claim, status: "insufficient_evidence", evidence: []
}], "C1", previousSuccessful.claim, {
    success: true,
    attempt: { status: "succeeded" },
    verification: { claimId: "C1", claim: previousSuccessful.claim, status: "supported", evidence: [{ sourceId: 1, excerpt: "Newly validated evidence." }] }
});
assert.equal(successfulRetry.succeeded, true);
assert.equal(successfulRetry.verifications[0].status, "supported");
assert.equal(successfulRetry.verifications[0].originalStatus, "insufficient_evidence");
console.log("Legacy report normalization checks passed.");
