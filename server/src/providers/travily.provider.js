import { tavily } from "@tavily/core";
import CONFIG from "../config/constants.js";
import { cacheService } from "../services/cache.service.js";

function getTavilyClient() {
    const apiKey = process.env.TAVILY_API_KEY;

    if (!apiKey) {
        throw new Error("TAVILY_API_KEY is missing from environment variables");
    }

    return tavily({ apiKey });
}

/**
 * Searches the web via Tavily with in-memory caching and timeout protection.
 * Reuses existing provider configuration and respects free-tier constraints.
 * 
 * @param {string} query - The search query
 * @param {object} options - Optional overrides (e.g., bypassCache, maxResults)
 */
export async function searchWeb(query, options = {}) {
    if (!query || typeof query !== "string" || !query.trim()) {
        throw new Error("A valid search query is required");
    }

    const trimmedQuery = query.trim();
    const cacheKey = `tavily:${trimmedQuery.toLowerCase()}`;

    // Check cache first to avoid consuming Tavily API credits
    if (!options.bypassCache) {
        const cached = cacheService.get(cacheKey);
        if (cached) {
            console.log(`[Cache Hit] Tavily query: "${trimmedQuery.slice(0, 50)}..."`);
            return {
                ...cached,
                cached: true
            };
        }
    }

    const client = getTavilyClient();
    const maxResults = options.maxResults || CONFIG.MAX_SOURCES_PER_SEARCH;

    console.log(`[Tavily Search] Query: "${trimmedQuery.slice(0, 60)}" (maxResults: ${maxResults})`);

    try {
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Tavily search timed out after ${CONFIG.SEARCH_TIMEOUT_MS}ms`)), CONFIG.SEARCH_TIMEOUT_MS)
        );

        const searchPromise = client.search(trimmedQuery, {
            searchDepth: "basic",
            maxResults,
            includeAnswer: false,
            includeRawContent: false
        });

        const result = await Promise.race([searchPromise, timeoutPromise]);

        const formatted = {
            query: trimmedQuery,
            answer: result.answer || null,
            sources: (result.results || []).map((item, index) => ({
                id: index + 1,
                title: item.title || "Untitled Source",
                url: item.url,
                content: item.content || "",
                score: typeof item.score === "number" ? item.score : null
            })),
            cached: false
        };

        // Cache successful search results
        cacheService.set(cacheKey, formatted, CONFIG.RESEARCH_CACHE_TTL_MINUTES);

        return formatted;
    } catch (error) {
        console.error("Tavily search provider error:", error.message);
        
        // Provide clear feedback if rate limited or quota exceeded
        if (error.message?.includes("429") || error.status === 429) {
            throw new Error("Tavily search rate limit or monthly quota exceeded. Please check free-tier quota.");
        }
        
        throw error;
    }
}
