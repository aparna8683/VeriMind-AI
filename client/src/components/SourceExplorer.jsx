import React, { useState } from "react";
import {
    Globe,
    ExternalLink,
    Info,
    ChevronDown,
    ChevronUp,
    Shield,
    BookOpen,
    Building2,
    Newspaper,
    FileCode,
    Tag
} from "lucide-react";

export function SourceExplorer({ sources = [], verifications = [] }) {
    const [expandedSourceIds, setExpandedSourceIds] = useState(new Set());

    function toggleExpand(sourceId) {
        setExpandedSourceIds((prev) => {
            const next = new Set(prev);
            if (next.has(sourceId)) next.delete(sourceId);
            else next.add(sourceId);
            return next;
        });
    }

    // Map source IDs to the claims that cite them
    const sourceClaimMap = new Map();
    verifications.forEach((v) => {
        (v.evidence || []).forEach((ev) => {
            if (ev.sourceId) {
                if (!sourceClaimMap.has(ev.sourceId)) {
                    sourceClaimMap.set(ev.sourceId, []);
                }
                sourceClaimMap.get(ev.sourceId).push({
                    claimId: v.claimId,
                    claim: v.claim,
                    status: v.status,
                    excerpt: ev.excerpt
                });
            }
        });
    });

    return (
        <section className="sources-explorer panel">
            <div className="section-title-row">
                <div>
                    <span className="section-eyebrow">RETRIEVED CITATIONS</span>
                    <h3 className="section-title">Source Explorer & Quality Profile</h3>
                </div>

                <div className="relevance-clarification-banner">
                    <Info size={13} />
                    <span>Search relevance scores measure query matching, NOT factual veracity or editorial endorsement.</span>
                </div>
            </div>

            <div className="sources-list-grid">
                {sources.map((source) => {
                    const quality = source.quality || {};
                    const isExpanded = expandedSourceIds.has(source.id);
                    const citedClaims = sourceClaimMap.get(source.id) || [];
                    const relevancePct = typeof source.score === "number" ? Math.round(source.score * 100) : null;

                    return (
                        <article
                            key={source.id}
                            id={`source-card-${source.id}`}
                            className="source-card"
                        >
                            <div className="source-card-header">
                                <div className="source-header-top">
                                    <div className="source-id-badge">Source [{source.id}]</div>
                                    <CategoryBadge category={quality.category} label={quality.categoryLabel} />
                                    {quality.domain && (
                                        <span className="domain-pill">{quality.domain}</span>
                                    )}
                                </div>

                                <h4 className="source-title-link">
                                    <a
                                        href={source.url}
                                        target="_blank"
                                        rel="noreferrer"
                                        title={`Open ${source.url}`}
                                    >
                                        {source.title || "Untitled Web Document"}
                                        <ExternalLink size={13} className="inline-link-icon" />
                                    </a>
                                </h4>

                                {/* Quality profile reason */}
                                {quality.reason && (
                                    <div className="source-quality-reason">
                                        <Info size={12} className="reason-icon" />
                                        <span>{quality.reason}</span>
                                    </div>
                                )}

                                {/* Retrieval relevance bar */}
                                {relevancePct !== null && (
                                    <div className="relevance-metric-row">
                                        <div className="relevance-label">
                                            <span>Retrieval Match:</span>
                                            <strong>{relevancePct}%</strong>
                                        </div>
                                        <div className="relevance-bar-track">
                                            <div
                                                className="relevance-bar-fill"
                                                style={{ width: `${relevancePct}%` }}
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Claims citing this source */}
                            {citedClaims.length > 0 && (
                                <div className="source-cited-claims">
                                    <span className="cited-label">
                                        <Tag size={12} />
                                        Cited by {citedClaims.length} Claim(s):
                                    </span>
                                    <div className="cited-chips-row">
                                        {citedClaims.map((c, idx) => (
                                            <span
                                                key={idx}
                                                className={`claim-ref-chip ref-${c.status}`}
                                                title={`Claim ${c.claimId} (${c.status}): "${c.claim}"`}
                                            >
                                                {c.claimId}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Collapsible snippet */}
                            <div className="source-card-footer">
                                <button
                                    type="button"
                                    className="btn btn-ghost btn-xs btn-expand-source"
                                    onClick={() => toggleExpand(source.id)}
                                >
                                    <span>{isExpanded ? "Hide source text excerpt" : "Inspect source text excerpt"}</span>
                                    {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                </button>

                                {isExpanded && (
                                    <div className="source-full-content">
                                        <p>{source.content || "No raw text available for this source."}</p>
                                    </div>
                                )}
                            </div>
                        </article>
                    );
                })}
            </div>
        </section>
    );
}

function CategoryBadge({ category, label }) {
    switch (category) {
        case "government_institutional":
        case "government_public_health":
            return (
                <span className="category-badge cat-gov">
                    <Building2 size={12} />
                    <span>{label || "Government / Institutional"}</span>
                </span>
            );
        case "peer_reviewed_research":
        case "academic_publisher":
        case "academic_research":
        case "professional_medical_association":
            return (
                <span className="category-badge cat-academic">
                    <BookOpen size={12} />
                    <span>{label || "Academic / Peer-Reviewed"}</span>
                </span>
            );
        case "official_documentation":
            return (
                <span className="category-badge cat-docs">
                    <FileCode size={12} />
                    <span>{label || "Official Docs"}</span>
                </span>
            );
        case "independent_journalism":
        case "reputable_journalism":
            return (
                <span className="category-badge cat-news">
                    <Newspaper size={12} />
                    <span>{label || "Independent News"}</span>
                </span>
            );
        case "industry_publication":
            return (
                <span className="category-badge cat-industry">
                    <Shield size={12} />
                    <span>{label || "Industry Analysis"}</span>
                </span>
            );
        case "company_vendor_blog":
        case "commercial_health_website":
            return (
                <span className="category-badge cat-blog">
                    <Globe size={12} />
                    <span>{label || "Vendor / Commercial"}</span>
                </span>
            );
        case "healthcare_organization":
            return (
                <span className="category-badge cat-gov">
                    <Building2 size={12} />
                    <span>{label || "Healthcare Organization"}</span>
                </span>
            );
        case "social_media_user_generated":
            return (
                <span className="category-badge cat-other">
                    <Globe size={12} />
                    <span>{label || "Social Media / User-Generated"}</span>
                </span>
            );
        case "personal_blog_forum":
            return (
                <span className="category-badge cat-other">
                    <Globe size={12} />
                    <span>{label || "Personal Blog / Forum"}</span>
                </span>
            );
        case "other_unknown":
        default:
            return (
                <span className="category-badge cat-other">
                    <Globe size={12} />
                    <span>{label || "General Web"}</span>
                </span>
            );
    }
}

export default SourceExplorer;
