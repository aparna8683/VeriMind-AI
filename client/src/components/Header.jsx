import React from "react";
import {
    BrainCircuit,
    History,
    BookOpen,
    Sun,
    Moon,
    PlusCircle,
    Activity
} from "lucide-react";

export function Header({
    theme,
    toggleTheme,
    onOpenHistory,
    historyCount = 0,
    onOpenMethodology,
    onReset,
    hasActiveReport,
    usage
}) {
    return (
        <header className="site-header">
            <div className="header-brand" onClick={onReset} role="button" tabIndex={0} title="Reset to workspace">
                <div className="brand-symbol">
                    <BrainCircuit size={22} />
                </div>
                <div className="brand-text">
                    <div className="brand-title">
                        VeriMind <span className="brand-accent">AI</span>
                    </div>
                    <div className="brand-tagline">Evidence-Grounded Intelligence</div>
                </div>
            </div>

            <div className="header-actions">
                {/* Live session usage transparent pill */}
                {usage && (
                    <div className="usage-pill" title="Free-tier session budget consumption">
                        <Activity size={13} className="usage-icon" />
                        <span>Searches: <strong>{usage.searchesUsed ?? 0}</strong>/{usage.maxSearchesAllowed ?? 3}</span>
                        {usage.cacheHit && <span className="cache-tag">Cached</span>}
                    </div>
                )}

                {hasActiveReport && (
                    <button
                        className="btn btn-secondary btn-sm"
                        onClick={onReset}
                        title="Start a new research investigation"
                    >
                        <PlusCircle size={15} />
                        <span>New Research</span>
                    </button>
                )}

                <button
                    className="btn btn-ghost btn-sm"
                    onClick={onOpenHistory}
                    title="View local research history"
                >
                    <History size={16} />
                    <span>History</span>
                    {historyCount > 0 && <span className="badge-count">{historyCount}</span>}
                </button>

                <button
                    className="btn btn-ghost btn-sm"
                    onClick={onOpenMethodology}
                    title="How VeriMind works and methodology limitations"
                >
                    <BookOpen size={16} />
                    <span>Methodology</span>
                </button>

                <button
                    className="btn btn-icon theme-toggle"
                    onClick={toggleTheme}
                    title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
                    aria-label="Toggle theme"
                >
                    {theme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
                </button>
            </div>
        </header>
    );
}

export default Header;
