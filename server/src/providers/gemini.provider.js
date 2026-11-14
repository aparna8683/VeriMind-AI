
import { GoogleGenAI } from "@google/genai";

function getGeminiClient() {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        throw new Error("GEMINI_API_KEY is missing");
    }

    return new GoogleGenAI({ apiKey });
}

const delay = (ms) =>
    new Promise((resolve) => setTimeout(resolve, ms));

export async function generateWithGemini(prompt) {
    const ai = getGeminiClient();
    const model = process.env.GEMINI_MODEL;

    if (!model) {
        throw new Error("GEMINI_MODEL is missing");
    }

    console.log("Gemini model being used:", model);

    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const response = await ai.models.generateContent({
                model,
                contents: prompt,
                config: {
                    systemInstruction:
                        "You are an AI research assistant. Provide accurate, clear and structured responses.",
                    temperature: 0.2
                }
            });

            return response.text || "";

        } catch (error) {
            const status = error.status || error.code;

            if (status !== 503 || attempt === maxAttempts) {
                throw error;
            }

            console.log(
                `Gemini temporarily unavailable. Retry ${attempt}/${maxAttempts}...`
            );

            await delay(attempt * 2000);
        }
    }
}
