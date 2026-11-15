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
import { normalizeResearchReport } from "./utils/report";
import { applyReverificationResult } from "./utils/reverification";

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
            const normalizedData = normalizeResearchReport(data);
            setResult(normalizedData);

            // Save to local research history
            const updated = saveResearchReport(normalizedData);
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

        const persistReport = (updatedResult) => {
            setResult(updatedResult);
            saveResearchReport(updatedResult);
            setHistory(getResearchHistory());
        };
        const markAttemptFailed = (code, message) => {
            const merged = applyReverificationResult(result.verification?.verifications, claimId, claimText, {
                success: false,
                attempt: { status: "failed", code, message }
            });
            if (merged.updated) {
                persistReport({ ...result, verification: { ...result.verification, verifications: merged.verifications } });
                loadUsage();
            }
        };

        try {
            const reverifyRes = await reverifyClaim(claimId, claimText, result.sources || [], {
                verifications: result.verification?.verifications || [],
                claims: result.claims?.claims || []
            });
            const updatedVerification = reverifyRes.verification;
            const merged = applyReverificationResult(result.verification?.verifications, claimId, claimText, reverifyRes);

            if (merged.succeeded) {
                // Update claim in verification list
                // Update sources if new sources were added
                const updatedSources = reverifyRes.allSources || result.sources;

                const updatedResult = {
                    ...result,
                    sources: updatedSources,
                    sourceFreshness: reverifyRes.sourceFreshness || result.sourceFreshness,
                    verification: {
                        ...result.verification,
                        summary: reverifyRes.verificationSummary || result.verification?.summary,
                        verifications: merged.verifications
                    },
                    trustAssessment: reverifyRes.trustAssessment || result.trustAssessment
                };

                persistReport(updatedResult);
                loadUsage();
            } else if (merged.updated) {
                persistReport({ ...result, verification: { ...result.verification, verifications: merged.verifications } });
                loadUsage();
            }
        } catch {
            markAttemptFailed("REVERIFICATION_REQUEST_FAILED", "Re-verification request failed; the previous verification result was kept.");
        } finally {
            setReverifyingClaimId(null);
        }
    }

    function handleSelectHistoryItem(historyItem) {
        if (historyItem.fullReport) {
            setResult(normalizeResearchReport(historyItem.fullReport));
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
                        {result.dataIntegrityIssues?.length > 0 && (
                            <div className="error-banner" role="alert">
                                <strong>Report data integrity warning</strong>
                                <ul>{result.dataIntegrityIssues.map((issue, index) => <li key={index}>{issue}</li>)}</ul>
                                {result.unmappedVerifications?.length > 0 && (
                                    <p>{result.unmappedVerifications.length} unmapped verification record(s) were excluded from claim review and trust metrics.</p>
                                )}
                            </div>
                        )}
                        {/* 1. Synthesized Research Report */}
                        <ResearchReport
                            report={result}
                            onRerunFresh={handleRerunFresh}
                        />

                        {/* 2. Evidence Overview & Trust Assessment */}
                        {!result.dataIntegrityIssues?.length && (
                            <EvidenceOverview
                                trustAssessment={result.trustAssessment}
                                sourcesCount={result.sources?.length || 0}
                                sourceFreshness={result.sourceFreshness || null}
                            />
                        )}

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
