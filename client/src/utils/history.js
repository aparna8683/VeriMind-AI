/**
 * LocalStorage Research History Manager
 * Completely client-side, zero external database costs.
 */

const STORAGE_KEY = "verimind_research_history";
const MAX_HISTORY_ITEMS = 15;

export function getResearchHistory() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
        console.warn("Failed to load research history from localStorage:", err);
        return [];
    }
}

export function saveResearchReport(report) {
    if (!report || !report.query) return;

    try {
        const history = getResearchHistory();
        // Remove duplicate query if already exists
        const filtered = history.filter(
            (item) => item.query.toLowerCase() !== report.query.toLowerCase()
        );

        const summaryItem = {
            id: `hist_${Date.now()}`,
            query: report.query,
            timestamp: report.timestamp || new Date().toISOString(),
            totalClaims: report.verification?.totalClaims || 0,
            supportRate: report.trustAssessment?.metrics?.supportRate ?? 0,
            contradictionRate: report.trustAssessment?.metrics?.contradictionRate ?? 0,
            assessment: report.trustAssessment?.assessment || "limited",
            assessmentLabel: report.trustAssessment?.assessmentLabel || "Assessed",
            fullReport: report
        };

        const updated = [summaryItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
    } catch (err) {
        console.warn("Failed to save research report to localStorage:", err);
        return [];
    }
}

export function deleteHistoryItem(id) {
    try {
        const history = getResearchHistory();
        const updated = history.filter((item) => item.id !== id);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
    } catch (err) {
        console.warn("Failed to delete history item:", err);
        return [];
    }
}

export function clearResearchHistory() {
    try {
        localStorage.removeItem(STORAGE_KEY);
        return [];
    } catch (err) {
        console.warn("Failed to clear research history:", err);
        return [];
    }
}
