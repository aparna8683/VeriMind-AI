import React from "react";
import {
    CheckCircle2,
    XCircle,
    HelpCircle,
    FileCheck2,
    ShieldAlert,
    ShieldCheck,
    Globe2,
    Info,
    AlertTriangle,
    Layers
} from "lucide-react";

export function EvidenceOverview({ trustAssessment, sourcesCount = 0 }) {
    if (!trustAssessment) return null;

    const {
        assessment,
        assessmentLabel,
        metrics = {},
        sourceDiversity,
        warnings = [],
        disclaimer
    } = trustAssessment;

    const {
        totalClaims = 0,
        supported = 0,
        partiallySupported = 0,
        contradicted = 0,
        insufficientEvidence = 0,
        traceableClaims = 0,
        supportRate = 0,
        partialSupportRate = 0,
        contradictionRate = 0,
        unresolvedRate = 0,
        traceabilityRate = 0
    } = metrics;

    const isContradicted = contradicted > 0;

    return (
        <section className="evidence-overview">
            <div className="section-title-row">
                <div>
                    <span className="section-eyebrow">INTELLIGENCE SYNTHESIS</span>
                    <h3 className="section-title">Evidence Overview & Trust Assessment</h3>
                </div>
                <div className="disclaimer-chip" title="Evidence-alignment disclosure">
                    <Info size={13} />
                    <span>Alignment with sources · Not absolute truth</span>
                </div>
            </div>

            {/* Metrics cards grid */}
            <div className="metrics-summary-grid">
                <div className="stat-card">
                    <div className="stat-card-header">
                        <span className="stat-label">Total Claims</span>
                        <FileCheck2 size={18} className="stat-icon text-muted" />
                    </div>
                    <div className="stat-value">{totalClaims}</div>
                    <div className="stat-subtext">Atomic statements extracted</div>
                </div>

                <div className="stat-card stat-success">
                    <div className="stat-card-header">
                        <span className="stat-label">Supported</span>
                        <CheckCircle2 size={18} className="stat-icon text-success" />
                    </div>
                    <div className="stat-value">{supported}</div>
                    <div className="stat-subtext">{supportRate}% fully corroborated</div>
                </div>

                {partiallySupported > 0 && (
                    <div className="stat-card stat-partial">
                        <div className="stat-card-header">
                            <span className="stat-label">Partially Supported</span>
                            <Layers size={18} className="stat-icon text-blue" />
                        </div>
                        <div className="stat-value">{partiallySupported}</div>
                        <div className="stat-subtext">{partialSupportRate}% partial corroboration</div>
                    </div>
                )}

                <div className={`stat-card ${isContradicted ? "stat-danger" : ""}`}>
                    <div className="stat-card-header">
                        <span className="stat-label">Contradicted</span>
                        <XCircle size={18} className={`stat-icon ${isContradicted ? "text-danger" : "text-muted"}`} />
                    </div>
                    <div className={`stat-value ${isContradicted ? "text-danger" : ""}`}>{contradicted}</div>
                    <div className="stat-subtext">
                        {isContradicted ? `${contradictionRate}% conflicting evidence` : "Zero conflicts"}
                    </div>
                </div>

                <div className="stat-card stat-warning">
                    <div className="stat-card-header">
                        <span className="stat-label">Unresolved</span>
                        <HelpCircle size={18} className="stat-icon text-warning" />
                    </div>
                    <div className="stat-value">{insufficientEvidence}</div>
                    <div className="stat-subtext">{unresolvedRate}% insufficient evidence</div>
                </div>

                <div className="stat-card">
                    <div className="stat-card-header">
                        <span className="stat-label">Traceability</span>
                        <ShieldCheck size={18} className="stat-icon text-accent" />
                    </div>
                    <div className="stat-value">{traceabilityRate}%</div>
                    <div className="stat-subtext">{traceableClaims} claims have verified quotes</div>
                </div>

                <div className="stat-card">
                    <div className="stat-card-header">
                        <span className="stat-label">Sources & Domains</span>
                        <Globe2 size={18} className="stat-icon text-muted" />
                    </div>
                    <div className="stat-value">
                        {sourcesCount}
                        <span className="stat-secondary"> / {sourceDiversity?.uniqueDomainsCount || 1} domains</span>
                    </div>
                    <div className="stat-subtext">
                        {sourceDiversity?.primarySourcesCount || 0} institutional / primary
                    </div>
                </div>
            </div>

            {/* Trust Assessment synthesis banner */}
            <div className={`trust-banner ${assessment}`}>
                <div className="trust-banner-header">
                    <div className="trust-status-indicator">
                        {isContradicted ? (
                            <ShieldAlert className="trust-icon text-danger" size={24} />
                        ) : assessment === "strong" ? (
                            <ShieldCheck className="trust-icon text-success" size={24} />
                        ) : (
                            <AlertTriangle className="trust-icon text-warning" size={24} />
                        )}
                        <div>
                            <div className="trust-category-label">OVERALL EVIDENCE ALIGNMENT</div>
                            <h4 className="trust-status-title">{assessmentLabel}</h4>
                        </div>
                    </div>

                    <div className="trust-score-badge">
                        <span className="score-number">{supportRate}%</span>
                        <span className="score-desc">Support Ratio</span>
                    </div>
                </div>

                {/* Multi-segment progress bar */}
                <div className="alignment-bar-wrapper" title="Evidence distribution bar">
                    <div
                        className="bar-segment seg-supported"
                        style={{ width: `${supportRate}%` }}
                        title={`Supported: ${supportRate}%`}
                    />
                    <div
                        className="bar-segment seg-partial"
                        style={{ width: `${partialSupportRate}%` }}
                        title={`Partially Supported: ${partialSupportRate}%`}
                    />
                    <div
                        className="bar-segment seg-contradicted"
                        style={{ width: `${contradictionRate}%` }}
                        title={`Contradicted: ${contradictionRate}%`}
                    />
                    <div
                        className="bar-segment seg-unresolved"
                        style={{ width: `${unresolvedRate}%` }}
                        title={`Unresolved: ${unresolvedRate}%`}
                    />
                </div>

                <div className="bar-legend">
                    <span className="legend-item"><span className="dot dot-success" /> Supported ({supported})</span>
                    {partiallySupported > 0 && (
                        <span className="legend-item"><span className="dot dot-partial" /> Partial ({partiallySupported})</span>
                    )}
                    <span className="legend-item"><span className="dot dot-danger" /> Contradicted ({contradicted})</span>
                    <span className="legend-item"><span className="dot dot-warning" /> Insufficient ({insufficientEvidence})</span>
                </div>

                {/* Warnings Callouts */}
                {warnings.length > 0 && (
                    <div className="trust-warnings-box">
                        <div className="warnings-heading">
                            <AlertTriangle size={15} />
                            <span>Audit Flags & Evidence Observations</span>
                        </div>
                        <ul className="warnings-list">
                            {warnings.map((w, idx) => (
                                <li key={idx}>{w}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Epistemological Disclaimer */}
                <div className="trust-disclaimer">
                    <Info size={14} className="disclaimer-icon" />
                    <p>{disclaimer}</p>
                </div>
            </div>
        </section>
    );
}

export default EvidenceOverview;
