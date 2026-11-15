import assert from "node:assert";
import CONFIG from "./src/config/constants.js";
import { cacheService } from "./src/services/cache.service.js";
import { budgetService, RequestBudgetTracker } from "./src/services/budget.service.js";
import { assessSourceQuality, assessSources } from "./src/services/source-quality.service.js";
import { buildTrustAssessment } from "./src/services/trust-assessment.service.js";
import {
    normalizeVerificationItem,
    isExcerptInSource,
    selectSourcesForClaim
} from "./src/agents/claim-verifier.agent.js";
import { buildVerificationQualification, reverifySpecificClaim } from "./src/services/research.service.js";

console.log("=========================================");
console.log(" Running VeriMind AI Backend Unit Tests ");
console.log("=========================================\n");

let passed = 0;
let total = 0;

function test(name, fn) {
    total++;
    try {
        fn();
        

console.log(`[PASS] ${name}`);
        passed++;
    } catch (err) {
        console.error(`[FAIL] ${name}`);
        console.error("  ", err.message);
    }
}

async function testAsync(name, fn) {
    total++;
    try {
        await fn();
        console.log(`[PASS] ${name}`);
        passed++;
    } catch (err) {
        console.error(`[FAIL] ${name}`);
        console.error("  ", err.message);
    }
}

// 1. Config tests
test("CONFIG defaults are defined and positive numbers", () => {
    assert.strictEqual(typeof CONFIG.PORT, "number");
    assert.ok(CONFIG.MAX_SEARCHES_PER_RESEARCH >= 1);
    assert.ok(CONFIG.MAX_SOURCES_PER_SEARCH >= 1);
    assert.ok(CONFIG.MAX_CLAIMS_PER_RESEARCH >= 1);
    assert.ok(CONFIG.RESEARCH_CACHE_TTL_MINUTES >= 1);
});

// 2. Cache service tests
test("CacheService stores, retrieves, and handles TTL correctly", () => {
    cacheService.clear();
    assert.strictEqual(cacheService.get("test:key"), null);

    cacheService.set("test:key", { data: 123 }, 1); // 1 minute
    const item = cacheService.get("test:key");
    assert.deepStrictEqual(item, { data: 123 });

    // Case and whitespace insensitivity
    const itemInsensitive = cacheService.get("  TEST:KEY  ");
    assert.deepStrictEqual(itemInsensitive, { data: 123 });

    const stats = cacheService.getStats();
    assert.strictEqual(stats.hits, 2);
    assert.strictEqual(stats.size, 1);
});

// 3. Budget service tests
test("BudgetService and RequestBudgetTracker enforce search limits", () => {
    const tracker = new RequestBudgetTracker(2, 1);
    assert.strictEqual(tracker.canSearch(), true);
    assert.strictEqual(tracker.consumeSearch(false), true);
    assert.strictEqual(tracker.searchesUsed, 1);

    assert.strictEqual(tracker.canSearch(), true);
    assert.strictEqual(tracker.consumeSearch(true), true);
    assert.strictEqual(tracker.searchesUsed, 2);
    assert.strictEqual(tracker.reverificationSearchesUsed, 1);

    // Limit exceeded
    assert.strictEqual(tracker.canSearch(), false);
    assert.strictEqual(tracker.consumeSearch(false), false);
    assert.strictEqual(tracker.limitReached, true);

    const report = tracker.getReport();
    assert.strictEqual(report.searchesUsed, 2);
    assert.strictEqual(report.limitReached, true);
});

// 4. Source quality assessment tests
test("assessSourceQuality accurately identifies domains and sets transparent reasons", () => {
    const govSource = assessSourceQuality({
        id: 1,
        url: "https://www.cdc.gov/flu/treatment/index.html",
        title: "CDC Flu Treatment Guidelines"
    });
    assert.strictEqual(govSource.category, "government_institutional");
    assert.strictEqual(govSource.isPrimarySourceLikely, true);
    assert.ok(govSource.reason.includes("cdc.gov"));

    const academicSource = assessSourceQuality({
        id: 2,
        url: "https://arxiv.org/abs/2301.00001",
        title: "Deep Learning Foundations"
    });
    assert.strictEqual(academicSource.category, "academic_research");
    assert.strictEqual(academicSource.isPrimarySourceLikely, true);

    const newsSource = assessSourceQuality({
        id: 3,
        url: "https://www.reuters.com/technology/ai-update-2024",
        title: "Reuters Tech Wire"
    });
    assert.strictEqual(newsSource.category, "independent_journalism");

    const blogSource = assessSourceQuality({
        id: 4,
        url: "https://blog.company.com/announcing-new-product",
        title: "Company Blog"
    });
    assert.strictEqual(blogSource.category, "company_vendor_blog");
});

test("assessSources aggregates diversity statistics", () => {
    const sampleSources = [
        { id: 1, url: "https://www.nature.com/articles/s41586", title: "Nature" },
        { id: 2, url: "https://www.nature.com/articles/s41587", title: "Nature 2" },
        { id: 3, url: "https://www.reuters.com/world/update", title: "Reuters" }
    ];

    const result = assessSources(sampleSources);
    assert.strictEqual(result.sources.length, 3);
    assert.strictEqual(result.diversity.uniqueDomainsCount, 2); // nature.com, reuters.com
    assert.strictEqual(result.diversity.primarySourcesCount, 2);
});

// 5. Trust assessment tests
test("buildTrustAssessment calculates rates and flags contradictions correctly", () => {
    const mockVerifications = {
        verifications: [
            { claimId: "C1", claim: "Claim one.", status: "supported", evidence: [{ excerpt: "confirmed text" }] },
            { claimId: "C2", claim: "Claim two.", status: "supported", evidence: [{ excerpt: "confirmed text 2" }] },
            { claimId: "C3", claim: "Claim three.", status: "supported", evidence: [{ excerpt: "confirmed text 3" }] },
            { claimId: "C4", claim: "Claim four.", status: "insufficient_evidence", evidence: [] }
        ]
    };

    const assessment = buildTrustAssessment(mockVerifications);
    assert.strictEqual(assessment.metrics.totalClaims, 4);
    assert.strictEqual(assessment.metrics.supported, 3);
    assert.strictEqual(assessment.metrics.insufficientEvidence, 1);
    assert.strictEqual(assessment.metrics.supportRate, 75);
    assert.strictEqual(assessment.metrics.contradictionRate, 0);
    assert.strictEqual(assessment.metrics.traceabilityRate, 75);
    assert.strictEqual(assessment.assessment, "moderate");

    // Contradiction scenario must immediately downgrade assessment
    const contradictedVerifications = {
        verifications: [
            { claimId: "C1", claim: "Claim one.", status: "supported", evidence: [{ excerpt: "confirmed text" }] },
            { claimId: "C2", claim: "Claim two.", status: "contradicted", evidence: [{ excerpt: "conflicting text" }] }
        ]
    };

    const contradictedAssessment = buildTrustAssessment(contradictedVerifications);
    assert.strictEqual(contradictedAssessment.assessment, "contradicted");
    assert.ok(contradictedAssessment.warnings.some((w) => w.includes("conflict")));
});


 // 6. Claim verification normalization tests (no external API calls)
test("excerpt validation requires the complete quotation to occur in the source", () => {
    const source = "Toyota announced a planned 10 GWh battery plant in Japan for 2027.";
    assert.equal(isExcerptInSource("planned 10 GWh battery plant in Japan for 2027", source), true);
    assert.equal(isExcerptInSource("planned 10 GWh battery plant in Japan for 2028", source), false);
    assert.equal(isExcerptInSource("Toyota announced a planned 10 GWh battery plant in Japan for 2027. Invented tail.", source), false);
});

test("unsupported model rationale is replaced when no excerpt validates", () => {
    const result = normalizeVerificationItem(
        { id: "C1", text: "Toyota's plant begins production in 2027." },
        { status: "supported", rationale: "The source directly confirms this.", evidence: [{ sourceId: 1, excerpt: "This quotation is not in the source." }] },
        [{ id: 1, title: "Source", url: "https://example.com", content: "The source discusses battery development." }]
    );
    assert.equal(result.status, CONFIG.STATUSES.INSUFFICIENT_EVIDENCE);
    assert.equal(result.evidence.length, 0);
    assert.match(result.rationale, /No model-provided excerpt passed/);
    assert.doesNotMatch(result.rationale, /directly confirms/i);
});

test("validated excerpts do not make rationale claim more than quotation matching proves", () => {
    const sourceText = "Toyota announced a planned 10 GWh battery plant in Japan for 2027.";
    const result = normalizeVerificationItem(
        { id: "C2", text: "Toyota plans a 10 GWh battery plant for 2027." },
        { status: "supported", evidence: [{ sourceId: 1, excerpt: sourceText }] },
        [{ id: 1, title: "Toyota", url: "https://example.com", content: sourceText }]
    );
    assert.equal(result.status, CONFIG.STATUSES.SUPPORTED);
    assert.equal(result.evidence.length, 1);
    assert.match(result.rationale, /does not independently prove/);
});

test("compound claim status is derived from validated assertion-level outcomes", () => {
    const supportedText = "Toyota announced a planned 10 GWh battery plant in Japan for 2027.";
    const result = normalizeVerificationItem(
        {
            id: "C3",
            text: "Toyota plans a 10 GWh plant in 2027 and it will serve premium models.",
            isCompound: true,
            subAssertions: [
                "Toyota plans a 10 GWh plant in 2027.",
                "The plant will serve premium models."
            ]
        },
        {
            status: "supported",
            evidence: [],

            assertionResults: [
                {
                    assertion: "Toyota plans a 10 GWh plant in 2027.",
                    status: "supported",
                    evidence: [{ sourceId: 1, excerpt: supportedText }]
                },
                {
                    assertion: "The plant will serve premium models.",
                    status: "supported",
                    evidence: [{ sourceId: 1, excerpt: "A quotation that does not exist in the source." }]
                }
            ]
        },
        [{ id: 1, title: "Toyota", url: "https://example.com", content: supportedText }]
    );
    assert.equal(result.status, CONFIG.STATUSES.PARTIALLY_SUPPORTED);
    assert.equal(result.assertionResults[0].status, CONFIG.STATUSES.SUPPORTED);
    assert.equal(result.assertionResults[1].status, CONFIG.STATUSES.INSUFFICIENT_EVIDENCE);
    assert.equal(result.evidence.length, 1);
});

test("missing assertion-level results on a compound claim are a technical failure", () => {
    const result = normalizeVerificationItem(
        { id: "C4", text: "A compound claim.", isCompound: true, subAssertions: ["Part one.", "Part two."] },
        { status: "supported", evidence: [] },
        []
    );
    assert.equal(result.status, CONFIG.STATUSES.VERIFICATION_ERROR);
    assert.equal(result.verificationError.code, "ASSERTION_RESULTS_MISSING");
});

test("trust metrics exclude technical and malformed records and cap the rating", () => {
    const assessment = buildTrustAssessment({
        verifications: [
            { claimId: "C1", claim: "A supported claim.", status: "supported", evidence: [{ excerpt: "verified quote" }] },
            { claimId: "C2", claim: "A failed claim.", status: "verification_error", evidence: [] },
            { claimId: "C3", claim: "An invalid claim.", status: "unknown_status", evidence: [] }
        ]
    });
    assert.equal(assessment.metrics.totalClaims, 1);
    assert.equal(assessment.metrics.supported, 1);
    assert.equal(assessment.metrics.technicalFailures, 2);
    assert.equal(assessment.metrics.invalidRecords, 1);
    assert.equal(assessment.metrics.supportRate, 100);
    assert.equal(assessment.assessment, "limited");
});

test("social platforms are classified separately and excluded from primary-source counts", () => {
    const result = assessSources([
        { id: 1, url: "https://www.linkedin.com/posts/example", title: "LinkedIn post" },
        { id: 2, url: "https://www.facebook.com/example", title: "Facebook post" },
        { id: 3, url: "https://www.nature.com/articles/example", title: "Research article" },
        { id: 4, url: "https://www.cdc.gov/example", title: "Institutional guidance" },
        { id: 5, url: "https://blog.company.com/launch", title: "Company announcement" }
    ]);
    assert.equal(result.diversity.socialMediaSourcesCount, 2);
    assert.equal(result.diversity.academicResearchSourcesCount, 1);
    assert.equal(result.diversity.institutionalSourcesCount, 1);
    assert.equal(result.diversity.commercialSourcesCount, 1);
    assert.equal(result.sources[0].quality.category, "social_media_user_generated");
});



test("claim source selection uses lexical relevance and bounded provider-score fallback", () => {
    const sources = [
        { id: 1, title: "Quantum mechanics overview", content: "Quantum systems and wave functions." },
        { id: 2, title: "Ocean currents", content: "Measurements of ocean currents.", score: 0.9 },
        { id: 3, title: "Bird migration", content: "Seasonal migration patterns.", score: 0.2 }
    ];
    assert.deepStrictEqual(
        selectSourcesForClaim({ text: "Quantum mechanics" }, sources, 1).map((source) => source.id),
        [1]
    );
    assert.deepStrictEqual(
        selectSourcesForClaim({ text: "Unrelated topic" }, sources.slice(1), 1).map((source) => source.id),
        [2]
    );
    assert.deepStrictEqual(
        selectSourcesForClaim({ text: "Unrelated topic" }, sources.slice(1).map(({ score, ...source }) => source), 1),
        []
    );
});

test("verification evidence cannot come from a source outside the claim's allowed source IDs", () => {
    const sourceA = "A validated quotation from the relevant source.";
    const result = normalizeVerificationItem(
        { id: "C5", text: "A claim supported by the selected source." },
        { status: "supported", evidence: [{ sourceId: 2, excerpt: "A validated quotation from the other source." }] },
        [
            { id: 1, title: "Allowed", url: "https://example.com/allowed", content: sourceA },
            { id: 2, title: "Not allowed", url: "https://example.com/other", content: "A validated quotation from the other source." }
        ],
        new Set([1])
    );
    assert.strictEqual(result.status, CONFIG.STATUSES.INSUFFICIENT_EVIDENCE);
    assert.strictEqual(result.evidence.length, 0);
});

test("absence claims require a source that explicitly states the absence", () => {
    const sourceText = "The article describes the intervention and its measured outcomes.";
    const result = normalizeVerificationItem(
        {
            id: "C6",
            text: "The article does not provide direct comparative data.",
            isCompound: true,
            subAssertions: ["The article does not provide direct comparative data."]
        },
        {
            status: "supported",
            assertionResults: [{
                assertion: "The article does not provide direct comparative data.",
                status: "supported",
                evidence: [{ sourceId: 1, excerpt: sourceText }],
                evidenceState: "explicitly_stated"
            }]
        },
        [{ id: 1, title: "Article", url: "https://example.com/article", content: sourceText }]
    );
    assert.strictEqual(result.status, CONFIG.STATUSES.INSUFFICIENT_EVIDENCE);
    assert.strictEqual(result.assertionResults[0].evidenceState, "not_found_in_retrieved_excerpts");
});


test("trust assessment detects missing results against the expected extracted claim set", () => {
    const assessment = buildTrustAssessment({
        verifications: [
            { claimId: "C1", claim: "Fact one.", status: "supported", evidence: [{ sourceId: 1, excerpt: "verified quote" }] },
            { claimId: "C3", claim: "Fact three.", status: "verification_error", evidence: [] }
        ]
    }, null, [
        { id: "C1", text: "Fact one." },
        { id: "C2", text: "Fact two." },
        { id: "C3", text: "Fact three." }
    ]);
    assert.strictEqual(assessment.metrics.expectedClaims, 3);
    assert.strictEqual(assessment.metrics.totalClaims, 1);
    assert.strictEqual(assessment.metrics.supported, 1);
    assert.strictEqual(assessment.metrics.technicalFailures, 2);
    assert.strictEqual(assessment.assessment, "limited");
});

test("final narrative qualification reflects unresolved claim verification", () => {
    const note = buildVerificationQualification({
        summary: { supported: 3, partiallySupported: 0, contradicted: 0, insufficientEvidence: 7, technicalFailures: 0 },
        verifications: []
    });
    assert.match(note, /3 of 10 valid claims as supported/);
    assert.match(note, /does not establish a definitive answer/);
});

test("technical verification failures are disclosed as non-factual outcomes", () => {
    const note = buildVerificationQualification({
        summary: { supported: 2, partiallySupported: 0, contradicted: 0, insufficientEvidence: 1, technicalFailures: 2 },
        verifications: []
    });
    assert.match(note, /technical verification failures/);
    assert.match(note, /not factual judgments/);
});

test("even fully supported claim audits are not described as factual certainty", () => {
    const note = buildVerificationQualification({
        summary: { supported: 4, partiallySupported: 0, contradicted: 0, insufficientEvidence: 0, technicalFailures: 0 },
        verifications: []
    });
    assert.match(note, /not factual certainty/);
});


await testAsync("manual reverification reports search failures without replacing the prior result", async () => {
    const result = await reverifySpecificClaim(
        "C1",
        "A real extracted claim.",
        [],
        {
            claims: [{ id: "C1", text: "A real extracted claim." }],
            verifications: [{ claimId: "C1", claim: "A real extracted claim.", status: "insufficient_evidence", evidence: [] }]
        },
        {
            searchWeb: async () => { throw new Error("Tavily unavailable"); },
            verifyClaims: async () => { throw new Error("Verification should not run"); }
        }
    );
    assert.strictEqual(result.success, false);
    assert.strictEqual(result.attempt.status, "failed");
    assert.strictEqual(result.verification, null);
});

await testAsync("manual reverification validates report identity and recalculates trust metrics", async () => {
    const excerpt = "A real extracted claim is supported by this source.";
    const result = await reverifySpecificClaim(
        "C1",
        "A real extracted claim.",
        [],
        {
            claims: [{ id: "C1", text: "A real extracted claim." }],
            verifications: [{ claimId: "C1", claim: "A real extracted claim.", status: "insufficient_evidence", evidence: [] }]
        },
        {
            searchWeb: async () => ({ sources: [{ url: "https://example.org/source", title: "Source", content: excerpt }] }),
            verifyClaims: async () => ({ verifications: [{
                claimId: "C1",
                claim: "A real extracted claim.",
                status: "supported",
                evidence: [{ sourceId: 1, excerpt }]
            }] })
        }
    );
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.verification.status, "supported");
    assert.strictEqual(result.trustAssessment.metrics.supportRate, 100);
    assert.strictEqual(result.trustAssessment.metrics.expectedClaims, 1);
});

console.log(`\nResults: ${passed} of ${total} tests passed.`);
if (passed === total) {
    console.log("All unit tests passed successfully!\n");
    process.exit(0);
} else {
    console.error("Some tests failed.\n");
    process.exit(1);
}
