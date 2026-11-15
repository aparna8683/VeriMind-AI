import React, { useState } from "react";
import {
    CheckCircle2,
    XCircle,
    HelpCircle,
    Layers,
    Search,
    ExternalLink,
    Copy,
    Check,
    ChevronDown,
    ChevronUp,
    RefreshCw,
    Maximize2,
    Minimize2
} from "lucide-react";
import { copyToClipboard } from "../utils/clipboard";

export function ClaimExplorer({
    verifications = [],
    onReverifyClaim,
    reverifyingClaimId
}) {
    const [filterStatus, setFilterStatus] = useState("all");
    const [searchQuery, setSearchQuery] = useState("");
    const [expandedIds, setExpandedIds] = useState(new Set(verifications.map((v) => v.claimId)));
    const [copiedId, setCopiedId] = useState(null);

    const counts = {
        all: verifications.length,
        supported: verifications.filter((v) => v.status === "supported").length,
        partially_supported: verifications.filter((v) => v.status === "partially_supported").length,
        contradicted: verifications.filter((v) => v.status === "contradicted").length,
        insufficient_evidence: verifications.filter((v) => v.status === "insufficient_evidence").length,
        verification_error: verifications.filter((v) => v.status === "verification_error").length
    };

    const filteredClaims = verifications.filter((item) => {
        // Status filter
        if (filterStatus !== "all" && item.status !== filterStatus) {
            return false;
        }
        // Text search
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
            const inText = item.claim.toLowerCase().includes(query);
            const inRationale = item.rationale.toLowerCase().includes(query);
            const inEvidence = item.evidence?.some((e) =>
                e.excerpt?.toLowerCase().includes(query) || e.sourceTitle?.toLowerCase().includes(query)
            );
            return inText || inRationale || inEvidence;
        }
        return true;
    });

    function toggleExpand(claimId) {
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(claimId)) next.delete(claimId);
            else next.add(claimId);
            return next;
        });
    }

    function toggleExpandAll() {
        if (expandedIds.size === filteredClaims.length) {
            setExpandedIds(new Set());
        } else {
            setExpandedIds(new Set(verifications.map((v) => v.claimId)));
        }
    }

    async function handleCopyClaim(item) {
        const evidenceStr = (item.evidence || [])
            .map((e) => `[Source ${e.sourceId}: ${e.sourceTitle}] "${e.excerpt}" (${e.url})`)
            .join("\n");

        const text = `CLAIM [${item.claimId}]: ${item.claim}\nSTATUS: ${item.status.toUpperCase()}\nRATIONALE: ${item.rationale}\nEVIDENCE:\n${evidenceStr || "None"}`;

        const success = await copyToClipboard(text);
        if (success) {
            setCopiedId(item.claimId);
            setTimeout(() => setCopiedId(null), 2000);
        }
    }

    return (
        <section className="claims-explorer panel">
            <div className="section-title-row">
                <div>
                    <span className="section-eyebrow">EVIDENCE AUDIT LOG</span>
                    <h3 className="section-title">Claim Verification Explorer</h3>
                </div>

                <div className="toolbar-actions">
                    <button
                        type="button"
                        className="btn btn-ghost btn-xs"
                        onClick={toggleExpandAll}
                        title="Toggle expand/collapse on all claims"
                    >
                        {expandedIds.size === filteredClaims.length ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                        <span>{expandedIds.size === filteredClaims.length ? "Collapse All" : "Expand All"}</span>
                    </button>
                </div>
            </div>

            {/* Filter toolbar */}
            <div className="claims-toolbar">
                <div className="filter-tabs">
                    <button
                        type="button"
                        className={`tab-btn ${filterStatus === "all" ? "active" : ""}`}
                        onClick={() => setFilterStatus("all")}
                    >
                        All Claims <span className="tab-count">{counts.all}</span>
                    </button>
                    <button
                        type="button"
                        className={`tab-btn tab-supported ${filterStatus === "supported" ? "active" : ""}`}
                        onClick={() => setFilterStatus("supported")}
                    >
                        Supported <span className="tab-count">{counts.supported}</span>
                    </button>
                    {counts.partially_supported > 0 && (
                        <button
                            type="button"
                            className={`tab-btn tab-partial ${filterStatus === "partially_supported" ? "active" : ""}`}
                            onClick={() => setFilterStatus("partially_supported")}
                        >
                            Partial <span className="tab-count">{counts.partially_supported}</span>
                        </button>
                    )}
                    <button
                        type="button"
                        className={`tab-btn tab-contradicted ${filterStatus === "contradicted" ? "active" : ""}`}
                        onClick={() => setFilterStatus("contradicted")}
                    >
                        Contradicted <span className="tab-count">{counts.contradicted}</span>
                    </button>
                    <button
                        type="button"
                        className={`tab-btn tab-unresolved ${filterStatus === "insufficient_evidence" ? "active" : ""}`}
                        onClick={() => setFilterStatus("insufficient_evidence")}
                    >
                        Insufficient Evidence <span className="tab-count">{counts.insufficient_evidence}</span>
                    </button>
                    {counts.verification_error > 0 && (
                        <button
                            type="button"
                            className={`tab-btn tab-unresolved ${filterStatus === "verification_error" ? "active" : ""}`}
                            onClick={() => setFilterStatus("verification_error")}
                        >
                            Verification Failed <span className="tab-count">{counts.verification_error}</span>
                        </button>
                    )}
                </div>

                <div className="search-filter-input">
                    <Search size={14} className="search-icon-muted" />
                    <input
                        type="text"
                        placeholder="Filter claims or keywords..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Claims list */}
            {filteredClaims.length === 0 ? (
                <div className="claims-empty">
                    <HelpCircle size={28} className="text-muted" />
                    <p>No claims match the active filter criteria.</p>
                </div>
            ) : (
                <div className="claims-card-list">
                    {filteredClaims.map((item) => {
                        const isExpanded = expandedIds.has(item.claimId);
                        const isReverifying = reverifyingClaimId === item.claimId;

                        return (
                            <article
                                key={item.claimId}
                                className={`claim-card status-border-${item.status}`}
                            >
                                <div className="claim-card-header" onClick={() => toggleExpand(item.claimId)}>
                                    <div className="claim-header-left">
                                        <span className="claim-id-tag">{item.claimId}</span>
                                        <StatusBadge status={item.status} />
                                        {item.isCompound && (
                                            <span className="badge badge-compound" title="Contains multiple independent assertions">
                                                Compound Claim
                                            </span>
                                        )}
                                        {item.reverificationAttempt?.status === "failed" ? (
                                            <span className="badge badge-warning" title={item.reverificationAttempt.message}>Retry failed; previous result kept</span>
                                        ) : item.reverified && (
                                            <span className="badge badge-reverified" title="Re-evaluated with targeted search">
                                                Re-verified
                                            </span>
                                        )}
                                    </div>

                                    <div className="claim-header-right" onClick={(e) => e.stopPropagation()}>
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-xs"
                                            onClick={() => handleCopyClaim(item)}
                                            title="Copy claim and evidence excerpt"
                                        >
                                            {copiedId === item.claimId ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                                            <span>{copiedId === item.claimId ? "Copied" : "Copy"}</span>
                                        </button>

                                        {onReverifyClaim && item.status === "insufficient_evidence" && (
                                            <button
                                                type="button"
                                                className="btn btn-secondary btn-xs"
                                                onClick={() => onReverifyClaim(item.claimId, item.claim)}
                                                disabled={isReverifying}
                                                title="Search additional web evidence for this claim"
                                            >
                                                <RefreshCw size={12} className={isReverifying ? "spin" : ""} />
                                                <span>{isReverifying ? "Searching..." : "Re-Search"}</span>
                                            </button>
                                        )}

                                        <button
                                            type="button"
                                            className="btn btn-icon btn-xs"
                                            onClick={() => toggleExpand(item.claimId)}
                                            title={isExpanded ? "Collapse claim details" : "Expand claim details"}
                                        >
                                            {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="claim-text-block">
                                    <p className="claim-statement-text">{item.claim}</p>
                                </div>

                                {isExpanded && (
                                    <div className="claim-details-content">
                                        {/* Rationale explanation */}
                                        <div className="claim-rationale-box">
                                            <strong>Verification Rationale:</strong>
                                            <p>{item.status === "verification_error"
                                                ? item.verificationError?.message || item.rationale || "Verification failed; no factual conclusion was reached."
                                                : item.rationale}</p>
                                        </div>

                                        {/* Sub-assertions if compound */}
                                        {item.assertionResults?.length > 0 ? (
                                            <div className="sub-assertions-box">
                                                <span className="box-sublabel">Assertion-Level Results:</span>
                                                <ul>
                                                    {item.assertionResults.map((assertion, idx) => (
                                                        <li key={idx}>
                                                            <strong>{assertion.status.replaceAll("_", " ")}</strong>: {assertion.assertion}
                                                            {assertion.evidenceState === "not_found_in_retrieved_excerpts" && (
                                                                <span> — Not established by the retrieved excerpts; this does not show the information is absent from the full source.</span>
                                                            )}
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ) : item.subAssertions?.length > 0 ? (
                                            <div className="sub-assertions-box">
                                                <span className="box-sublabel">Identified Sub-Assertions:</span>
                                                <ul>{item.subAssertions.map((sub, idx) => <li key={idx}>{sub}</li>)}</ul>
                                            </div>
                                        ) : null}

                                        {/* Evidence list */}
                                        <div className="claim-evidence-section">
                                            <span className="box-sublabel">
                                                Validated Verbatim Excerpts ({item.evidence?.length || 0}):
                                            </span>

                                            {!item.evidence || item.evidence.length === 0 ? (
                                                <div className="evidence-none">
                                                    <HelpCircle size={14} />
                                                    <span>No verbatim supporting or conflicting excerpt validated in retrieved sources.</span>
                                                </div>
                                            ) : (
                                                <div className="evidence-cards-grid">
                                                    {item.evidence.map((ev, idx) => (
                                                        <div key={idx} className="evidence-tile">
                                                            <div className="evidence-tile-header">
                                                                <span className="source-pill">Source [{ev.sourceId}]</span>
                                                                <span className="source-title-truncate" title={ev.sourceTitle}>
                                                                    {ev.sourceTitle}
                                                                </span>
                                                                {ev.url && (
                                                                    <a
                                                                        href={ev.url}
                                                                        target="_blank"
                                                                        rel="noreferrer"
                                                                        className="source-external-link"
                                                                        title="Open source URL"
                                                                    >
                                                                        <ExternalLink size={12} />
                                                                    </a>
                                                                )}
                                                            </div>
                                                            <blockquote className="verbatim-quote">
                                                                “{ev.excerpt}”
                                                            </blockquote>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

function StatusBadge({ status }) {
    switch (status) {
        case "supported":
            return (
                <span className="status-badge status-supported">
                    <CheckCircle2 size={13} />
                    <span>SUPPORTED</span>
                </span>
            );
        case "partially_supported":
            return (
                <span className="status-badge status-partial">
                    <Layers size={13} />
                    <span>PARTIALLY SUPPORTED</span>
                </span>
            );
        case "contradicted":
            return (
                <span className="status-badge status-contradicted">
                    <XCircle size={13} />
                    <span>CONTRADICTED</span>
                </span>
            );
        case "verification_error":
            return (
                <span className="status-badge status-error" role="status">
                    <HelpCircle size={13} />
                    <span>VERIFICATION FAILED</span>
                </span>
            );
        case "insufficient_evidence":
        default:
            return (
                <span className="status-badge status-insufficient">
                    <HelpCircle size={13} />
                    <span>INSUFFICIENT EVIDENCE</span>
                </span>
            );
    }
}

export default ClaimExplorer;
