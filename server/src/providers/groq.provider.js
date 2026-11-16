import Groq from "groq-sdk";
import CONFIG from "../config/constants.js";

function getGroqClient() {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
        throw new Error("GROQ_API_KEY is missing from environment variables");
    }

    return new Groq({ apiKey });
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Strips markdown code blocks if the model wraps JSON in ```json ... ```
 */
function extractJsonString(rawText) {
    if (!rawText || typeof rawText !== "string") return "";
    let clean = rawText.trim();
    if (clean.startsWith("```json")) {
        clean = clean.slice(7);
    } else if (clean.startsWith("```")) {
        clean = clean.slice(3);
    }
    if (clean.endsWith("```")) {
        clean = clean.slice(0, -3);
    }
    return clean.trim();
}

/**
 * Text generation with Groq with exponential backoff on 429/503.
 */
export async function generateWithGroq(prompt) {
    const groq = getGroqClient();
    const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error(`Groq request timed out after ${CONFIG.LLM_TIMEOUT_MS}ms`)), CONFIG.LLM_TIMEOUT_MS)
            );

            const completionPromise = groq.chat.completions.create({
                model,
                messages: [
                    {
                        role: "system",
                        content: "You are VeriMind AI, an evidence-aware research assistant. Provide accurate, clear, and structured responses based strictly on evidence."
                    },
                    {
                        role: "user",
                        content: prompt
                    }
                ],
                temperature: 0.2
            });

            const completion = await Promise.race([completionPromise, timeoutPromise]);
            return completion.choices[0]?.message?.content || "";
        } catch (error) {
            const status = Number(error.status);
            const retryable = status === 429 || status === 503;

            if (!retryable || attempt === maxAttempts) {
                console.error(`[Groq Error] Status: ${status}, Message: ${error.message}`);
                throw error;
            }

            const retryAfter = Number(error.headers?.get?.("retry-after"));
            const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
                ? retryAfter * 1000
                : Math.min(2000 * Math.pow(2, attempt - 1), 10000);

            console.warn(`[Groq Rate Limit ${status}] Retrying attempt ${attempt + 1}/${maxAttempts} in ${delayMs}ms...`);
            await sleep(delayMs);
        }
    }
}

/**
 * Structured JSON generation with Groq with schema enforcement and error recovery.
 */
export async function generateJsonWithGroq(prompt) {
    const groq = getGroqClient();
    const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
    const timeoutMs = CONFIG.LLM_TIMEOUT_MS;
    const maxAttempts = 2;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            console.log(`[Groq JSON] Request attempt ${attempt}/${maxAttempts}`);

            const completion = await groq.chat.completions.create({
                model,
                messages: [
                    {
                        role: "system",
                        content: "You are a precise JSON-only extraction and verification engine. Output only a valid compact JSON object matching the requested structure."
                    },
                    { role: "user", content: prompt }
                ],
                temperature: 0,
                reasoning_effort: "low",
                max_completion_tokens: CONFIG.GROQ_JSON_MAX_TOKENS || 3000,
                response_format: { type: "json_object" }
            }, { signal: controller.signal, timeout: timeoutMs });

            const rawContent = completion.choices[0]?.message?.content;
            if (!rawContent) throw new Error("Groq returned an empty JSON response");

            return JSON.parse(extractJsonString(rawContent));
        } catch (error) {
            const status = Number(error.status);
            const isAbort =
                controller.signal.aborted ||
                error.name === "AbortError" ||
                error.name === "APIConnectionTimeoutError" ||
                error.name === "APIUserAbortError";

            if (isAbort || error.message?.toLowerCase().includes("timeout")) {
                const timeoutError = new Error(`Groq JSON request timed out after ${timeoutMs}ms`);
                timeoutError.code = "GROQ_TIMEOUT";
                console.error("[Groq JSON Timeout]", timeoutError.message);
                throw timeoutError;
            }

            if (error instanceof SyntaxError) {
                console.error("[Groq JSON Parse Error]", error.message);
                throw new Error("Groq returned invalid JSON");
            }

            const retryable = status === 429 || status === 503;

            if (!retryable || attempt === maxAttempts) {
                console.error(`[Groq JSON Error] Attempt ${attempt} failed:`, error.message);
                throw error;
            }

            const retryAfter = Number(error.headers?.get?.("retry-after"));
            const delayMs = Number.isFinite(retryAfter) && retryAfter > 0
                ? retryAfter * 1000
                : Math.min(1500 * Math.pow(2, attempt - 1), 6000);

            console.warn(`[Groq JSON Retry] HTTP ${status}. Retrying in ${delayMs}ms...`);
            await sleep(delayMs);
        } finally {
            clearTimeout(timeoutId);
        }
    }

    throw new Error("Groq JSON generation failed after retry attempts");
}