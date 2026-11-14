import React, { useState } from "react";
import {
    Search,
    ArrowRight,
    LoaderCircle,
    X,
    Layers,
    FileCheck2,
    ShieldCheck,
    Globe,
    Sparkles
} from "lucide-react";

const EXAMPLE_QUESTIONS = [
    {
        category: "Policy & Tech",
        query: "What are the key enforcement deadlines and prohibited systems under the European Union AI Act?"
    },
    {
        category: "Health & Biology",
        query: "Does intermittent fasting improve insulin sensitivity more effectively than continuous caloric restriction?"
    },
    {
        category: "Science & Energy",
        query: "Is solid-state battery technology commercially viable for mass-market electric vehicles before 2027?"
    },
    {
        category: "Economics & Cloud",
        query: "Did open source foundation models reduce enterprise cloud GPU spending over the last 12 months?"
    }
];

export function ResearchWorkspace({
    query,
    setQuery,
    onSearch,
    loading,
    error
}) {
    const [isFocused, setIsFocused] = useState(false);

    function handleSubmit(e) {
        if (e) e.preventDefault();
        if (!query.trim() || loading) return;
        onSearch(query.trim());
    }

    function handleKeyDown(e) {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit();
        }
    }

    function handleSelectExample(exampleQuery) {
        setQuery(exampleQuery);
    }

    function handleClear() {
        setQuery("");
    }

    return (
        <section className="research-hero">
            <div className="hero-badge">
                <span className="dot-live" />
                <span>Investigative Research Terminal</span>
            </div>

            <h1 className="hero-title">
                Don’t just generate answers.<br />
                <span className="text-editorial">Verify every claim.</span>
            </h1>

            <p className="hero-description">
                VeriMind AI retrieves evidence from real web sources, extracts atomic factual claims,
                cross-examines them against source text, and flags contradictions or evidence gaps.
            </p>

            <form
                className={`research-box ${isFocused ? "focused" : ""}`}
                onSubmit={handleSubmit}
            >
                <div className="research-input-wrapper">
                    <Search className="input-search-icon" size={20} />
                    <textarea
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                        placeholder="Enter an investigative research question or factual topic..."
                        rows={Math.max(2, Math.min(6, query.split("\n").length))}
                        disabled={loading}
                    />
                    {query && !loading && (
                        <button
                            type="button"
                            className="btn-clear"
                            onClick={handleClear}
                            title="Clear input"
                        >
                            <X size={16} />
                        </button>
                    )}
                </div>

                <div className="research-box-footer">
                    <div className="input-hints">
                        <span className="kbd-hint">Press <strong>Enter ↵</strong> to research · <strong>Shift + Enter</strong> for newline</span>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        disabled={loading || !query.trim()}
                    >
                        {loading ? (
                            <>
                                <LoaderCircle className="spin" size={17} />
                                <span>Investigating...</span>
                            </>
                        ) : (
                            <>
                                <span>Begin Research</span>
                                <ArrowRight size={17} />
                            </>
                        )}
                    </button>
                </div>
            </form>

            {loading && (
                <div className="pipeline-indicator">
                    <div className="pipeline-spinner">
                        <LoaderCircle className="spin" size={20} />
                    </div>
                    <div className="pipeline-text">
                        <strong>Executing Evidence Pipeline</strong>
                        <p>Searching the web → Synthesizing findings → Extracting atomic claims → Validating excerpts</p>
                    </div>
                </div>
            )}

            {error && (
                <div className="alert alert-error">
                    <strong>Investigation Error:</strong> {error}
                </div>
            )}

            {/* Example Queries */}
            {!loading && (
                <div className="example-section">
                    <div className="example-label">
                        <Sparkles size={14} />
                        <span>Example Research Topics</span>
                    </div>
                    <div className="example-grid">
                        {EXAMPLE_QUESTIONS.map((item, idx) => (
                            <button
                                key={idx}
                                type="button"
                                className="example-card"
                                onClick={() => handleSelectExample(item.query)}
                            >
                                <span className="example-category">{item.category}</span>
                                <p className="example-query">“{item.query}”</p>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Verification Process Pipeline Overview */}
            <div className="pipeline-overview">
                <div className="overview-title">THE VERIMIND VERIFICATION WORKFLOW</div>
                <div className="pipeline-steps">
                    <div className="step-card">
                        <div className="step-num">01</div>
                        <div className="step-icon"><Globe size={18} /></div>
                        <h4>Targeted Retrieval</h4>
                        <p>Fetches real web sources with domain and category profiling.</p>
                    </div>
                    <div className="step-card">
                        <div className="step-num">02</div>
                        <div className="step-icon"><Layers size={18} /></div>
                        <h4>Report Synthesis</h4>
                        <p>Produces an editorial report with explicit bracketed citations [1], [2].</p>
                    </div>
                    <div className="step-card">
                        <div className="step-num">03</div>
                        <div className="step-icon"><FileCheck2 size={18} /></div>
                        <h4>Atomic Extraction</h4>
                        <p>Isolates verifiable claims, separating facts from opinion or compounds.</p>
                    </div>
                    <div className="step-card">
                        <div className="step-num">04</div>
                        <div className="step-icon"><ShieldCheck size={18} /></div>
                        <h4>Cross-Examination</h4>
                        <p>Validates verbatim excerpts. Flags contradictions & insufficient evidence.</p>
                    </div>
                </div>
            </div>
        </section>
    );
}

export default ResearchWorkspace;
