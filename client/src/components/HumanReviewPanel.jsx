import React, { useState } from "react";
import {
    AlertCircle,
    AlertTriangle,
    ShieldAlert,
    ExternalLink,
    RefreshCw,
    CheckCircle2,
    Copy,
    Check,
    Search,
    ChevronDown,
    ChevronUp
} from "lucide-react";
import { copyToClipboard } from "../utils/clipboard";

export function HumanReviewPanel({
    verifications = [],
    onReverifyClaim,
    reverifyingClaimId
}) {
    const [copiedId, setCopiedId] = useState(null);
    const [collapsedIds, setCollapsedIds] = useState(new Set());

    // Filter items that require human scrutiny
    const flaggedItems = verifications.filter((item) => {
        return (
            item.status === "contradicted" ||
            item.status === "insufficient_evidence" ||
            item.status === "partially_supported" ||
            item.status === "verification_error" ||
            item.reverificationAttempt?.status === "failed" ||
            item.isCompound ||
            item.reviewNeeded
        );
    });

    function toggleCollapse(claimId) {
        setCollapsedIds((prev) => {
            const next = new Set(prev);
            if (next.has(claimId)) next.delete(claimId);
            else next.add(claimId);
            return next;
        });
    }

    async function handleCopyChecklist(item) {
        const text = `VERIMIND HUMAN REVIEW AUDIT:
Claim ID: ${item.claimId}
Claim: ${item.claim}
Status: ${item.status.toUpperCase()}
Reason for Review: ${item.reviewReason || "Evidence requires human inspection."}
Available Evidence: ${item.availableEvidenceSummary || "None"}
Missing Evidence: ${item.missingEvidence || "Direct citation confirmation."}
Recommended Action: ${item.recommendedAction || "Inspect source texts directly."}`;

        const success = await copyToClipboard(text);
        if (success) {
            setCopiedId(item.claimId);
            setTimeout(() => setCopiedId(null), 2000);
        }
    }

    return (
        <section className="review-section panel">
            <div className="review-header">
                <div className="review-title-group">
                    <div className="review-icon-badge">
                        <AlertCircle size={20} />
                    </div>
                    <div>
                        <div className="review-eyebrow">HUMAN-IN-THE-LOOP AUDIT</div>
                        <h3 className="review-heading">What Needs Your Verification?</h3>
                        <p className="review-subheading">
                            Algorithmic verification flags claims with contradictions, missing excerpts, or compound assertions.
                        </p>
                    </div>
                </div>

                <div className="review-count-badge">
                    <strong>{flaggedItems.length}</strong>
                    <span>flagged for review</span>
                </div>
            </div>

            {flaggedItems.length === 0 ? (
                <div className="review-empty-state">
                    <CheckCircle2 size={32} className="text-success" />
                    <h4>No claims flagged by automated audit rules</h4>
                    <p>
                        All extracted claims have matching verbatim excerpts in retrieved web sources with zero identified contradictions.
                    </p>
                    <span className="empty-disclaimer">
                        Note: Automated alignment does not replace professional domain expertise or primary literature review.
                    </span>
                </div>
            ) : (
                <div className="review-items-list">
                    {flaggedItems.map((item) => {
                        const isContradicted = item.status === "contradicted";
                        const isInsufficient = item.status === "insufficient_evidence";
                        const isPartial = item.status === "partially_supported";
                        const isVerificationError = item.status === "verification_error";
                        const isCollapsed = collapsedIds.has(item.claimId);
                        const isReverifying = reverifyingClaimId === item.claimId;

                        return (
                            <article
                                key={item.claimId}
                                className={`review-card ${isContradicted ? "border-danger" : isPartial ? "border-blue" : "border-warning"}`}
                            >
                                <div className="review-card-top">
                                    <div className="review-card-meta">
                                        <span className="claim-id-tag">{item.claimId}</span>
                                        <span className={`status-pill status-${item.status}`}>
                                            {isContradicted && <ShieldAlert size={13} />}
                                            {isInsufficient && <AlertTriangle size={13} />}
                                            {isPartial && <AlertCircle size={13} />}
                                            {item.status.replaceAll("_", " ")}
                                        </span>
                                        {item.isCompound && (
                                            <span className="badge badge-compound">Compound Statement</span>
                                        )}
                                        {item.reverificationAttempt?.status === "failed" ? (
                                            <span className="badge badge-warning" title={item.reverificationAttempt.message}>Retry failed; previous result kept</span>
                                        ) : item.reverified && (
                                            <span className="badge badge-reverified">Re-verified</span>
                                        )}
                                    </div>

                                    <div className="review-card-actions">
                                        <button
                                            type="button"
                                            className="btn btn-ghost btn-xs"
                                            onClick={() => handleCopyChecklist(item)}
                                            title="Copy review audit checklist"
                                        >
                                            {copiedId === item.claimId ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                                            <span>{copiedId === item.claimId ? "Copied" : "Copy Checklist"}</span>
                                        </button>

                                        {onReverifyClaim && (isInsufficient || isVerificationError) && (
                                            <button
                                                type="button"
                                                className="btn btn-secondary btn-xs"
                                                onClick={() => onReverifyClaim(item.claimId, item.claim)}
                                                disabled={isReverifying || !item.claim?.trim()}
                                                title="Perform focused search on this claim"
                                            >
                                                <RefreshCw size={12} className={isReverifying ? "spin" : ""} />
                                                <span>{isReverifying ? "Searching..." : isVerificationError ? "Retry Verification" : "Targeted Re-Search"}</span>
                                            </button>
                                        )}

                                        <button
                                            type="button"
                                            className="btn btn-icon btn-xs"
                                            onClick={() => toggleCollapse(item.claimId)}
                                            title={isCollapsed ? "Expand" : "Collapse"}
                                        >
                                            {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                                        </button>
                                    </div>
                                </div>

                                {/* 1. What the claim says */}
                                <div className="review-claim-statement">
                                    <span className="label-caption">ASSERTED CLAIM:</span>
                                    {item.claim?.trim()
                                        ? <blockquote className="claim-quote">“{item.claim}”</blockquote>
                                        : <p role="alert">Claim text is missing from this saved report. Re-run the research to restore this audit item.</p>}
                                </div>

                                {!isCollapsed && (
                                    <div className="review-breakdown-grid">
                                        {/* 2. Why it requires review */}
                                        <div className="breakdown-box box-reason">
                                            <div className="box-label">
                                                <AlertCircle size={13} />
                                                <span>Why it requires review</span>
                                            </div>
                                            <p>{isVerificationError
                                                ? item.verificationError?.message || item.rationale || "The verification process failed; this is not a factual conclusion."
                                                : item.reviewReason || item.rationale}</p>
                                        </div>

                                        {/* 3. What evidence is currently available */}
                                        <div className="breakdown-box box-available">
                                            <div className="box-label">
                                                <Search size={13} />
                                                <span>Currently Available Evidence</span>
                                            </div>
                                            <p>{item.availableEvidenceSummary || (item.evidence?.length > 0 ? `${item.evidence.length} excerpt(s) recorded` : "No direct excerpts located.")}</p>

                                            {item.evidence?.length > 0 && (
                                                <div className="evidence-mini-list">
                                                    {item.evidence.map((ev, i) => (
                                                        <div key={i} className="evidence-quote-snippet">
                                                            <div className="snippet-source">
                                                                Source [{ev.sourceId}] {ev.sourceTitle}
                                                            </div>
                                                            <div className="snippet-text">“{ev.excerpt}”</div>
                                                            {ev.url && (
                                                                <a href={ev.url} target="_blank" rel="noreferrer" className="snippet-link">
                                                                    Inspect source text <ExternalLink size={11} />
                                                                </a>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* 4. What evidence is missing */}
                                        <div className="breakdown-box box-missing">
                                            <div className="box-label">
                                                <AlertTriangle size={13} />
                                                <span>What Evidence is Missing</span>
                                            </div>
                                            <p>{item.missingEvidence || "Direct, unambiguous citation confirming all specific dates, figures, or asserted causality."}</p>
                                        </div>

                                        {/* 5. What the user should verify next */}
                                        <div className="breakdown-box box-action">
                                            <div className="box-label">
                                                <CheckCircle2 size={13} />
                                                <span>Recommended Next Step</span>
                                            </div>
                                            <p><strong>{item.recommendedAction}</strong></p>
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

export default HumanReviewPanel;
