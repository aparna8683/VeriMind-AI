
import express from "express";
import { generateWithGroq } from "../providers/groq.provider.js";
import { generateWithGemini } from "../providers/gemini.provider.js";

const router = express.Router();

// Direct Groq endpoint
router.post("/groq", async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt || typeof prompt !== "string") {
            return res.status(400).json({
                success: false,
                message: "A valid prompt is required"
            });
        }

        const response = await generateWithGroq(prompt);

        return res.status(200).json({
            success: true,
            provider: "Groq",
            response
        });

    } catch (error) {
        console.error("Groq API Error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Groq API request failed"
        });
    }
});

// Direct Gemini endpoint
router.post("/gemini", async (req, res) => {
    try {
        const { prompt } = req.body;

        if (!prompt || typeof prompt !== "string") {
            return res.status(400).json({
                success: false,
                message: "A valid prompt is required"
            });
        }

        const response = await generateWithGemini(prompt);

        return res.status(200).json({
            success: true,
            provider: "Gemini",
            response
        });

    } catch (error) {
        console.error("Gemini API Error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Gemini API request failed"
        });
    }
});

// Automatic provider fallback
router.post("/auto", async (req, res) => {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string") {
        return res.status(400).json({
            success: false,
            message: "A valid prompt is required"
        });
    }

    try {
        console.log("Trying Gemini...");

        const response = await generateWithGemini(prompt);

        return res.status(200).json({
            success: true,
            provider: "Gemini",
            fallbackUsed: false,
            response
        });

    } catch (geminiError) {
        console.warn("Gemini failed:", geminiError.message);
        console.log("Switching to Groq...");

        try {
            const response = await generateWithGroq(prompt);

            return res.status(200).json({
                success: true,
                provider: "Groq",
                fallbackUsed: true,
                response
            });

        } catch (groqError) {
            console.error("Groq fallback failed:", groqError.message);

            return res.status(502).json({
                success: false,
                message: "Both AI providers failed"
            });
        }
    }
});

export default router;
