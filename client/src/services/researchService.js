/**
 * VeriMind AI - Research Service
 * Frontend API client communicating with backend research and verification endpoints.
 */

const API_BASE_URL = "/api";

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

    const data = await response.json();

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

    const data = await response.json();

    if (!response.ok || !data.success) {
        throw new Error(data.message || "Targeted claim re-verification failed.");
    }

    return data;
}

export async function getUsageStats() {
    try {
        const response = await fetch(`${API_BASE_URL}/research/usage`);
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}

export async function clearServerCache() {
    const response = await fetch(`${API_BASE_URL}/research/cache/clear`, {
        method: "POST"
    });
    return await response.json();
}

export async function checkHealth() {
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        if (!response.ok) return null;
        return await response.json();
    } catch {
        return null;
    }
}
