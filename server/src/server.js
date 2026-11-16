import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import aiRoutes from "./routes/ai.routes.js";
import researchRoutes from "./routes/research.routes.js";
import { cacheService } from "./services/cache.service.js";
import { budgetService } from "./services/budget.service.js";
import CONFIG from "./config/constants.js";

dotenv.config();

const app = express();
const PORT = CONFIG.PORT;

// Allow the deployed Vercel app and local Vite development.
// Set CLIENT_URL on Render to override/add comma-separated frontend origins.
const allowedOrigins = (
    process.env.CLIENT_URL ||
    "https://veri-mind-ai-1buf.vercel.app,http://localhost:5173"
)
    .split(",")
    .map((origin) => origin.trim().replace(/\/$/, ""))
    .filter(Boolean);

// Middleware
app.use(cors({
    origin(origin, callback) {
        // Allow server-to-server requests and local tools that do not send an Origin.
        if (!origin || allowedOrigins.includes(origin.replace(/\/$/, ""))) {
            return callback(null, true);
        }

        return callback(new Error("This origin is not allowed by the API CORS policy."));
    }
}));
app.use(express.json({ limit: "2mb" }));

// API routes
app.use("/api/ai", aiRoutes);
app.use("/api/research", researchRoutes);

// Root endpoint
app.get("/", (req, res) => {
    res.status(200).json({
        success: true,
        message: "VeriMind AI Research & Verification API",
        version: "2.0.0",
        documentation: "POST /api/research/answer with { query } to generate evidence-backed research reports."
    });
});

// Health check with budget and provider transparency
app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "VeriMind AI backend is running healthy",
        timestamp: new Date().toISOString(),
        version: "2.0.0",
        providers: {
            groq: Boolean(process.env.GROQ_API_KEY),
            tavily: Boolean(process.env.TAVILY_API_KEY),
            gemini: Boolean(process.env.GEMINI_API_KEY),
            ollama: Boolean(process.env.OLLAMA_BASE_URL)
        },
        models: {
            groq: process.env.GROQ_MODEL || "llama-3.3-70b-versatile",
            gemini: process.env.GEMINI_MODEL || "gemini-1.5-flash"
        },
        limits: {
            maxSearchesPerResearch: CONFIG.MAX_SEARCHES_PER_RESEARCH,
            maxSourcesPerSearch: CONFIG.MAX_SOURCES_PER_SEARCH,
            maxClaimsPerResearch: CONFIG.MAX_CLAIMS_PER_RESEARCH,
            maxEvidenceSourcesPerClaim: CONFIG.MAX_EVIDENCE_SOURCES_PER_CLAIM,
            cacheTtlMinutes: CONFIG.RESEARCH_CACHE_TTL_MINUTES
        },
        cacheStats: cacheService.getStats(),
        sessionUsage: budgetService.getSessionStats()
    });
});

// Generic 404 handler for unknown routes
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Endpoint ${req.method} ${req.originalUrl} not found`
    });
});

// Centralized error handler (prevents leaking stack traces or credentials)
app.use((err, req, res, next) => {
    console.error("[Unhandled Error]:", err.message);
    res.status(err.status || 500).json({
        success: false,
        message: err.message || "An internal server error occurred"
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log("===============================================");
    console.log(`VeriMind AI API v2.0.0 listening on port ${PORT}`);
    console.log(`Health check: /api/health`);
    console.log(`Allowed frontend origins: ${allowedOrigins.join(", ")}`);
    console.log(`Max searches per query: ${CONFIG.MAX_SEARCHES_PER_RESEARCH}`);
    console.log(`Cache TTL: ${CONFIG.RESEARCH_CACHE_TTL_MINUTES} mins`);
    console.log("===============================================");
});
