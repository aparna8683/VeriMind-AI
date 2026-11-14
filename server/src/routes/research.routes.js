import express from "express";
import { searchWeb } from "../providers/travily.provider.js";
import { researchAndAnswer, reverifySpecificClaim } from "../services/research.service.js";
import { budgetService } from "../services/budget.service.js";
import { cacheService } from "../services/cache.service.js";

const router = express.Router();

/**
 * Reject greetings, acknowledgements, and very short non-research input
 * before they consume Tavily or Groq free-tier requests.
 */
function isResearchWorthyQuery(query) {
    const normalized = query.trim().toLowerCase().replace(/[.!?,]+$/g, "");
    const greetings = new Set([
        "hi", "hello", "helloo", "hey", "hii", "hiii", "good morning",
        "good afternoon", "good evening", "thanks", "thank you", "ok",
        "okay", "test", "testing", "yo", "bye"
    ]);

    if (greetings.has(normalized)) return false;
    if (normalized.length < 8) return false;

    return true;
}

/**
 * Direct web search endpoint
 */
router.post("/search", async (req, res) => {
    try {
        const { query } = req.body;

        if (!query || typeof query !== "string" || !query.trim()) {
            return res.status(400).json({
                success: false,
                message: "A valid, non-empty search query is required."
            });
        }

        const research = await searchWeb(query.trim());

        return res.status(200).json({
            success: true,
            provider: "Tavily",
            ...research
        });
    } catch (error) {
        console.error("Tavily search endpoint error:", error.message);
        const status = error.message?.includes("quota") || error.message?.includes("429") ? 429 : 500;

        return res.status(status).json({
            success: false,
            message: error.message || "Web research failed. Please check network connectivity or API quotas."
        });
    }
});

/**
 * Primary research and claim verification endpoint
 */
router.post("/answer", async (req, res) => {
    try {
        const { query, bypassCache } = req.body;

        if (!query || typeof query !== "string" || !query.trim()) {
            return res.status(400).json({
                success: false,
                message: "Please enter a research question or topic to investigate."
            });
        }

        const normalizedQuery = query.trim();

        if (!isResearchWorthyQuery(normalizedQuery)) {
            return res.status(400).json({
                success: false,
                code: "NOT_A_RESEARCH_QUERY",
                message: "Please enter a research question or a topic you want to investigate. For example: 'How is AI changing healthcare?'"
            });
        }

        console.log(`[API /research/answer] Processing: "${normalizedQuery.slice(0, 60)}"`);

        const result = await researchAndAnswer(normalizedQuery, { bypassCache });

        return res.status(200).json({
            success: true,
            provider: "Tavily + Groq",
            ...result
        });
    } catch (error) {
        console.error("Research pipeline error:", error.message);

        const isRateLimit = error.message?.includes("429") || error.message?.includes("quota") || error.status === 429;
        const isTimeout = error.message?.includes("timed out");
        const status = isRateLimit ? 429 : isTimeout ? 504 : 500;

        let userMessage = "Research and verification encountered an unexpected error.";
        if (isRateLimit) {
            userMessage = "API rate limit or monthly credit budget reached. Please wait a moment before trying again.";
        } else if (isTimeout) {
            userMessage = "The research request timed out while retrieving web sources or querying the model.";
        } else if (error.message) {
            userMessage = error.message;
        }

        return res.status(status).json({
            success: false,
            message: userMessage
        });
    }
});

/**
 * On-demand single claim re-verification endpoint
 */
router.post("/reverify-claim", async (req, res) => {
    try {
        const { claimId, claimText, sources } = req.body;

        if (!claimId || !claimText) {
            return res.status(400).json({
                success: false,
                message: "claimId and claimText are required for re-verification."
            });
        }

        console.log(`[API /research/reverify-claim] Claim ${claimId}: "${claimText.slice(0, 50)}..."`);

        const result = await reverifySpecificClaim(claimId, claimText, Array.isArray(sources) ? sources : []);

        return res.status(200).json({
            success: true,
            ...result
        });
    } catch (error) {
        console.error("Re-verification error:", error.message);
        return res.status(500).json({
            success: false,
            message: error.message || "Failed to re-verify the specified claim."
        });
    }
});

/**
 * Free-tier usage and budget transparency endpoint
 */
router.get("/usage", (req, res) => {
    const session = budgetService.getSessionStats();
    const cache = cacheService.getStats();

    return res.status(200).json({
        success: true,
        session,
        cache
    });
});

/**
 * Clear in-memory cache
 */
router.post("/cache/clear", (req, res) => {
    cacheService.clear();
    return res.status(200).json({
        success: true,
        message: "Research cache cleared successfully."
    });
});

export default router;
