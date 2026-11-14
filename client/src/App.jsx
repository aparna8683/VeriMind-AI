import React, { useState, useEffect, useCallback } from "react";
import Header from "./components/Header";
import ResearchWorkspace from "./components/ResearchWorkspace";
import ResearchReport from "./components/ResearchReport";
import EvidenceOverview from "./components/EvidenceOverview";
import HumanReviewPanel from "./components/HumanReviewPanel";
import ClaimExplorer from "./components/ClaimExplorer";
import SourceExplorer from "./components/SourceExplorer";
import MethodologyModal from "./components/MethodologyModal";
import ResearchHistoryDrawer from "./components/ResearchHistoryDrawer";

import {
    researchQuestion,
    reverifyClaim,
    getUsageStats
} from "./services/researchService";

import {
    getResearchHistory,
    saveResearchReport,
    deleteHistoryItem,
    clearResearchHistory
} from "./utils/history";

import "./App.css";

export function App() {
    const [query, setQuery] = useState("");
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    // Theme (Default: light theme, with user preference persistence)
    const [theme, setTheme] = useState(() => {
        const saved = localStorage.getItem("verimind_theme");
        return saved || "light";
    });

    // Modals and drawers
    const [isHistoryOpen, setIsHistoryOpen] = useState(false);
    const [isMethodologyOpen, setIsMethodologyOpen] = useState(false);
    const [history, setHistory] = useState(() => getResearchHistory());

    // Live session usage statistics from server
    const [sessionUsage, setSessionUsage] = useState(null);

    // Track active re-verification request for individual claim
    const [reverifyingClaimId, setReverifyingClaimId] = useState(null);

    const loadUsage = useCallback(async () => {
        const stats = await getUsageStats();
        if (stats?.session) {
            setSessionUsage(stats.session);
        }
    }, []);

    // Synchronize theme attribute to DOM root
    useEffect(() => {
        document.documentElement.setAttribute("data-theme", theme);
        localStorage.setItem("verimind_theme", theme);
    }, [theme]);

    // Initial load: usage stats
    useEffect(() => {
        let isMounted = true;
        getUsageStats().then((stats) => {
            if (isMounted && stats?.session) {
                setSessionUsage(stats.session);
            }
        });
        return () => {
            isMounted = false;
        };
    }, []);

    function toggleTheme() {
        setTheme((prev) => (prev === "dark" ? "light" : "dark"));
    }

    async function handleResearch(searchQuery, bypassCache = false) {
        const q = searchQuery || query;
        if (!q.trim() || loading) return;

        setLoading(true);
        setError("");

        try {
            const data = await researchQuestion(q.trim(), { bypassCache });
            setResult(data);

            // Save to local research history
            const updated = saveResearchReport(data);
            setHistory(updated || getResearchHistory());

            // Refresh session usage
            loadUsage();

            // Smooth scroll to top of report
            window.scrollTo({ top: 0, behavior: "smooth" });
        } catch (err) {
            console.error("Research failed:", err);
            setError(err.message || "An unexpected error occurred during research.");
        } finally {
            setLoading(false);
        }
    }

    async function handleRerunFresh() {
        if (!result?.query) return;
        await handleResearch(result.query, true);
    }

    async function handleReverifyClaim(claimId, claimText) {
        if (!result || reverifyingClaimId) return;

        setReverifyingClaimId(claimId);

        try {
            const reverifyRes = await reverifyClaim(claimId, claimText, result.sources || []);

            if (reverifyRes.success && reverifyRes.verification) {
                // Update claim in verification list
                const updatedVerifications = (result.verification?.verifications || []).map((item) => {
                    if (item.claimId === claimId) {
                        return {
                            ...reverifyRes.verification,
                            reverified: true,
                            originalStatus: item.status,
                            statusChanged: item.status !== reverifyRes.verification.status
                        };
                    }
                    return item;
                });

                // Update sources if new sources were added
                const updatedSources = reverifyRes.allSources || result.sources;

                const updatedResult = {
                    ...result,
                    sources: updatedSources,
                    verification: {
                        ...result.verification,
                        verifications: updatedVerifications
                    }
                };

                setResult(updatedResult);
                saveResearchReport(updatedResult);
                setHistory(getResearchHistory());
                loadUsage();
            }
        } catch (err) {
            alert(`Re-verification notice: ${err.message}`);
        } finally {
            setReverifyingClaimId(null);
        }
    }

    function handleSelectHistoryItem(historyItem) {
        if (historyItem.fullReport) {
            setResult(historyItem.fullReport);
            setQuery(historyItem.query);
            setIsHistoryOpen(false);
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    }

    function handleDeleteHistory(id) {
        const updated = deleteHistoryItem(id);
        setHistory(updated);
    }

    function handleClearAllHistory() {
        if (window.confirm("Clear all locally stored research history?")) {
            const updated = clearResearchHistory();
            setHistory(updated);
        }
    }

    function handleReset() {
        setResult(null);
        setQuery("");
        setError("");
        window.scrollTo({ top: 0, behavior: "smooth" });
    }

    return (
        <div className="verimind-app">
            <Header
                theme={theme}
                toggleTheme={toggleTheme}
                onOpenHistory={() => setIsHistoryOpen(true)}
                historyCount={history.length}
                onOpenMethodology={() => setIsMethodologyOpen(true)}
                onReset={handleReset}
                hasActiveReport={Boolean(result)}
                usage={result?.usage || sessionUsage}
            />

            <main className="main-layout">
                {/* When no report is active, show the prominent landing research workspace */}
                {!result && (
                    <ResearchWorkspace
                        query={query}
                        setQuery={setQuery}
                        onSearch={handleResearch}
                        loading={loading}
                        error={error}
                    />
                )}

                {/* When an active report exists, show the report and verification sections */}
                {result && (
                    <div className="report-view-container">
                        {/* 1. Synthesized Research Report */}
                        <ResearchReport
                            report={result}
                            onRerunFresh={handleRerunFresh}
                        />

                        {/* 2. Evidence Overview & Trust Assessment */}
                        <EvidenceOverview
                            trustAssessment={result.trustAssessment}
                            sourcesCount={result.sources?.length || 0}
                        />

                        {/* 3. Human-in-the-Loop Review Panel */}
                        <HumanReviewPanel
                            verifications={result.verification?.verifications || []}
                            onReverifyClaim={handleReverifyClaim}
                            reverifyingClaimId={reverifyingClaimId}
                        />

                        {/* 4. Claim Verification Explorer */}
                        <ClaimExplorer
                            verifications={result.verification?.verifications || []}
                            onReverifyClaim={handleReverifyClaim}
                            reverifyingClaimId={reverifyingClaimId}
                        />

                        {/* 5. Source Explorer & Quality Profile */}
                        <SourceExplorer
                            sources={result.sources || []}
                            verifications={result.verification?.verifications || []}
                        />
                    </div>
                )}
            </main>

            <footer className="site-footer">
                <div className="footer-content">
                    <div className="footer-left">
                        <strong>VeriMind AI</strong> · Evidence-grounded research intelligence.
                    </div>
                    <div className="footer-right">
                        <span>Zero external cost architecture · Free-tier first · </span>
                        <button
                            type="button"
                            className="footer-link-btn"
                            onClick={() => setIsMethodologyOpen(true)}
                        >
                            Methodology & Disclaimers
                        </button>
                    </div>
                </div>
            </footer>

            {/* Modals & Drawers */}
            <MethodologyModal
                isOpen={isMethodologyOpen}
                onClose={() => setIsMethodologyOpen(false)}
            />

            <ResearchHistoryDrawer
                isOpen={isHistoryOpen}
                onClose={() => setIsHistoryOpen(false)}
                history={history}
                onSelectHistoryItem={handleSelectHistoryItem}
                onDeleteItem={handleDeleteHistory}
                onClearAll={handleClearAllHistory}
            />
        </div>
    );
}

export default App;
