/**
 * VeriMind AI Configuration & Application Limits
 * 
 * Free-tier optimization defaults.
 * All limits are configurable via environment variables.
 */

export const CONFIG = {
    // Port & Environment
    PORT: parseInt(process.env.PORT || "5000", 10),
    NODE_ENV: process.env.NODE_ENV || "development",

    // Free-tier research budget controls
    MAX_SEARCHES_PER_RESEARCH: parseInt(process.env.MAX_SEARCHES_PER_RESEARCH || "3", 10),
    MAX_SOURCES_PER_SEARCH: parseInt(process.env.MAX_SOURCES_PER_SEARCH || "5", 10),
    MAX_CLAIMS_PER_RESEARCH: parseInt(process.env.MAX_CLAIMS_PER_RESEARCH || "10", 10),
    MAX_EVIDENCE_SOURCES_PER_CLAIM: parseInt(process.env.MAX_EVIDENCE_SOURCES_PER_CLAIM || "3", 10),
    MAX_REVERIFICATION_ATTEMPTS: parseInt(process.env.MAX_REVERIFICATION_ATTEMPTS || "1", 10),
    RESEARCH_CACHE_TTL_MINUTES: parseInt(process.env.RESEARCH_CACHE_TTL_MINUTES || "30", 10),

    // Request timeouts (ms)
    SEARCH_TIMEOUT_MS: parseInt(process.env.SEARCH_TIMEOUT_MS || "15000", 10),
    LLM_TIMEOUT_MS: parseInt(process.env.LLM_TIMEOUT_MS || "45000", 10),
    GROQ_JSON_MAX_TOKENS: parseInt(process.env.GROQ_JSON_MAX_TOKENS || "1200", 10),

    // Verification statuses
    STATUSES: {
        SUPPORTED: "supported",
        PARTIALLY_SUPPORTED: "partially_supported",
        CONTRADICTED: "contradicted",
        INSUFFICIENT_EVIDENCE: "insufficient_evidence"
    }
};

export default CONFIG;
