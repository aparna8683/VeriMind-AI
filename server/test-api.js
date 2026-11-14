import assert from "node:assert";
import { EventEmitter } from "node:events";
import express from "express";

import aiRoutes from "./src/routes/ai.routes.js";
import researchRoutes from "./src/routes/research.routes.js";
import { cacheService } from "./src/services/cache.service.js";
import { budgetService } from "./src/services/budget.service.js";
import CONFIG from "./src/config/constants.js";

const app = express();
app.use(express.json());
app.use("/api/ai", aiRoutes);
app.use("/api/research", researchRoutes);

app.get("/", (req, res) => {
    res.status(200).json({ success: true, message: "VeriMind API v2.0.0" });
});

app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "VeriMind AI backend is running healthy",
        timestamp: new Date().toISOString(),
        version: "2.0.0",
        providers: {
            groq: Boolean(process.env.GROQ_API_KEY),
            tavily: Boolean(process.env.TAVILY_API_KEY)
        },
        limits: {
            maxSearchesPerResearch: CONFIG.MAX_SEARCHES_PER_RESEARCH,
            maxSourcesPerSearch: CONFIG.MAX_SOURCES_PER_SEARCH,
            maxClaimsPerResearch: CONFIG.MAX_CLAIMS_PER_RESEARCH,
            cacheTtlMinutes: CONFIG.RESEARCH_CACHE_TTL_MINUTES
        },
        cacheStats: cacheService.getStats(),
        sessionUsage: budgetService.getSessionStats()
    });
});

/**
 * In-memory HTTP dispatcher for Express without needing TCP network sockets.
 */
function dispatch(app, { method = "GET", url = "/", body = null, headers = {} }) {
    return new Promise((resolve) => {
        const req = new EventEmitter();
        req.method = method;
        req.url = url;
        req.originalUrl = url;
        req.headers = {
            "content-type": "application/json",
            ...headers
        };
        req.body = body;

        let statusCode = 200;
        let responseHeaders = {};
        let responseBody = "";

        const res = {
            status(code) {
                statusCode = code;
                return this;
            },
            setHeader(name, value) {
                responseHeaders[name.toLowerCase()] = value;
                return this;
            },
            getHeader(name) {
                return responseHeaders[name.toLowerCase()];
            },
            json(data) {
                responseHeaders["content-type"] = "application/json";
                responseBody = JSON.stringify(data);
                this.end(responseBody);
                return this;
            },
            send(data) {
                responseBody = typeof data === "object" ? JSON.stringify(data) : String(data);
                this.end(responseBody);
                return this;
            },
            end(chunk) {
                if (chunk && !responseBody) responseBody = String(chunk);
                let json = null;
                try {
                    json = JSON.parse(responseBody);
                } catch {}
                resolve({
                    status: statusCode,
                    headers: responseHeaders,
                    body: responseBody,
                    json
                });
            }
        };

        app.handle(req, res, (err) => {
            if (err) {
                resolve({
                    status: 500,
                    headers: {},
                    body: err.message,
                    json: { success: false, message: err.message }
                });
            } else {
                resolve({
                    status: 404,
                    headers: {},
                    body: "Not Found",
                    json: { success: false, message: "Not Found" }
                });
            }
        });
    });
}

async function runTests() {
    console.log("==================================================");
    console.log(" VeriMind AI API Integration & Security Tests     ");
    console.log("==================================================\n");

    let passed = 0;
    let total = 0;

    async function check(name, fn) {
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

    // Test 1: Root endpoint
    await check("Root endpoint returns success and version", async () => {
        const res = await dispatch(app, { method: "GET", url: "/" });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.json.success, true);
    });

    // Test 2: Health endpoint
    await check("Health endpoint exposes provider booleans and limits without exposing secrets", async () => {
        const res = await dispatch(app, { method: "GET", url: "/api/health" });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.json.success, true);
        assert.strictEqual(typeof res.json.providers.groq, "boolean");
        assert.strictEqual(typeof res.json.providers.tavily, "boolean");
        assert.ok(res.json.limits.maxSearchesPerResearch > 0);
        assert.ok(res.json.limits.maxClaimsPerResearch > 0);

        // Security check: ensure no actual key values leak
        const rawBody = JSON.stringify(res.json);
        assert.strictEqual(rawBody.includes("gsk_"), false, "GROQ key leaked in health endpoint!");
        assert.strictEqual(rawBody.includes("tvly-"), false, "Tavily key leaked in health endpoint!");
    });

    // Test 3: Empty research input rejected
    await check("Empty research query is rejected with 400 Bad Request", async () => {
        const res = await dispatch(app, {
            method: "POST",
            url: "/api/research/answer",
            body: { query: "   " }
        });
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.json.success, false);
        assert.ok(res.json.message.includes("question") || res.json.message.includes("topic"));
    });

    // Test 4: Missing query field is rejected
    await check("Missing query field is rejected with 400 Bad Request", async () => {
        const res = await dispatch(app, {
            method: "POST",
            url: "/api/research/answer",
            body: {}
        });
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.json.success, false);
    });

    // Test 5: Empty search endpoint rejected
    await check("Empty search query is rejected with 400 Bad Request", async () => {
        const res = await dispatch(app, {
            method: "POST",
            url: "/api/research/search",
            body: { query: "" }
        });
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.json.success, false);
    });

    // Test 6: Reverify endpoint requires claimId and claimText
    await check("Reverify endpoint validates required parameters", async () => {
        const res = await dispatch(app, {
            method: "POST",
            url: "/api/research/reverify-claim",
            body: {}
        });
        assert.strictEqual(res.status, 400);
        assert.strictEqual(res.json.success, false);
    });

    // Test 7: Usage endpoint returns budget and session stats
    await check("Usage endpoint returns live session statistics", async () => {
        const res = await dispatch(app, {
            method: "GET",
            url: "/api/research/usage"
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.json.success, true);
        assert.ok("session" in res.json);
        assert.ok("cache" in res.json);
        assert.strictEqual(typeof res.json.session.totalResearchRequests, "number");
    });

    // Test 8: Cache clear endpoint works
    await check("Cache clear endpoint returns success", async () => {
        const res = await dispatch(app, {
            method: "POST",
            url: "/api/research/cache/clear"
        });
        assert.strictEqual(res.status, 200);
        assert.strictEqual(res.json.success, true);
    });

    console.log(`\nResults: ${passed} of ${total} API tests passed.`);
    if (passed === total) {
        console.log("All API integration and security tests passed successfully!\n");
        process.exit(0);
    } else {
        console.error("Some API tests failed.\n");
        process.exit(1);
    }
}

runTests();
