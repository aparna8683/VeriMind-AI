import assert from "node:assert";
import CONFIG from "./src/config/constants.js";
import { cacheService } from "./src/services/cache.service.js";
import { budgetService, RequestBudgetTracker } from "./src/services/budget.service.js";
import { assessSourceQuality, assessSources } from "./src/services/source-quality.service.js";
import { buildTrustAssessment } from "./src/services/trust-assessment.service.js";

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
            { claimId: "C1", status: "supported", evidence: [{ excerpt: "confirmed text" }] },
            { claimId: "C2", status: "supported", evidence: [{ excerpt: "confirmed text 2" }] },
            { claimId: "C3", status: "supported", evidence: [{ excerpt: "confirmed text 3" }] },
            { claimId: "C4", status: "insufficient_evidence", evidence: [] }
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
            { claimId: "C1", status: "supported", evidence: [{ excerpt: "confirmed text" }] },
            { claimId: "C2", status: "contradicted", evidence: [{ excerpt: "conflicting text" }] }
        ]
    };

    const contradictedAssessment = buildTrustAssessment(contradictedVerifications);
    assert.strictEqual(contradictedAssessment.assessment, "contradicted");
    assert.ok(contradictedAssessment.warnings.some((w) => w.includes("conflict")));
});

console.log(`\nResults: ${passed} of ${total} tests passed.`);
if (passed === total) {
    console.log("All unit tests passed successfully!\n");
    process.exit(0);
} else {
    console.error("Some tests failed.\n");
    process.exit(1);
}
