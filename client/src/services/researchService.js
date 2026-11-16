/**
 * VeriMind AI - Research Service
 * Frontend API client communicating with the deployed backend.
 */

// Vercel uses the Render backend by default. For local development, override
// VITE_API_URL in client/.env.local with http://localhost:5000.
const API_ORIGIN = (
    import.meta.env.VITE_API_URL || "https://verimind-ai.onrender.com"
).trim().replace(/\/+$/, "");
const API_BASE_URL = `${API_ORIGIN}/api`;

async function readJsonResponse(response) {
    const body = await response.text();

    try {
        return JSON.parse(body);
    } catch {
        throw new Error(
            `The API returned a non-JSON response (HTTP ${response.status}). ` +
            `Check that the backend is available at ${API_ORIGIN}. ` +
            `Response: ${body.slice(0, 140)}`
        );
    }
}

export async function researchQuestion(query, options = {}) {
    if (!query || typeof query !== "string" || !query.trim()) {
        throw new Error("Please enter a research topic or question.");
    }

    const response = await fetch(`${API_BASE_URL}/research/answer`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            query: query.trim(),
            bypassCache: Boolean(options.bypassCache)
        })
    });

    const data = await readJsonResponse(response);

    if (!response.ok || !data.success) {
        throw new Error(data.message || `Research request failed (${response.status})`);
    }

    return data;
}

export async function reverifyClaim(claimId, claimText, sources = [], reportContext = {}) {
    if (!claimId || !claimText) {
        throw new Error("claimId and claimText are required for re-verification.");
    }

    const response = await fetch(`${API_BASE_URL}/research/reverify-claim`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            claimId,
            claimText,
            sources,
            verifications: reportContext.verifications || [],
            claims: reportContext.claims || []
        })
    });

    const data = await readJsonResponse(response);

    if (!response.ok) {
        throw new Error(data.message || "Targeted claim re-verification request failed.");
    }

    // A structured verification failure is an expected result, not a transport error.
    // Return it so the caller can preserve the previous claim result and show the failure reason.
    return data;
}

export async function getUsageStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/research/usage`);
        if (!response.ok) return null;
        return await readJsonResponse(response);
    } catch {
        return null;
    }
}

export async function clearServerCache() {
    const response = await fetch(`${API_BASE_URL}/research/cache/clear`, {
        method: "POST"
    });
    return await readJsonResponse(response);
}

export async function checkHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (!response.ok) return null;
        return await readJsonResponse(response);
    } catch {
        return null;
    }
}
