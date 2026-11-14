import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
    Copy,
    Check,
    Download,
    RefreshCw,
    Clock,
    FileText
} from "lucide-react";
import { copyToClipboard } from "../utils/clipboard";

export function ResearchReport({
    report,
    onRerunFresh,
    onSelectSource
}) {
    const [copiedSummary, setCopiedSummary] = useState(false);
    const [copiedFull, setCopiedFull] = useState(false);

    if (!report) return null;

    const { query, answer, timestamp, usage, sources } = report;

    async function handleCopySummary() {
        let summaryText = answer;
        const execMatch = answer.match(/## Executive Summary([\s\S]*?)(?=##|$)/i);
        if (execMatch && execMatch[1]) {
            summaryText = execMatch[1].trim();
        } else {
            summaryText = answer.slice(0, 600) + "...";
        }

        const success = await copyToClipboard(summaryText);
        if (success) {
            setCopiedSummary(true);
            setTimeout(() => setCopiedSummary(false), 2000);
        }
    }

    async function handleCopyFull() {
        const fullMarkdown = `# Research Report: ${query}\nDate: ${timestamp}\n\n${answer}`;
        const success = await copyToClipboard(fullMarkdown);
        if (success) {
            setCopiedFull(true);
            setTimeout(() => setCopiedFull(false), 2000);
        }
    }

    function handleDownloadReport() {
        const fullMarkdown = `# VeriMind AI Research Report\n**Question:** ${query}\n**Date:** ${new Date(timestamp).toLocaleString()}\n\n---\n\n${answer}\n\n---\n## Evidence Sources\n` +
            (sources || []).map((s) => `[${s.id}] ${s.title} (${s.url}) - Domain: ${s.quality?.domain || 'web'}`).join("\n");

        const blob = new Blob([fullMarkdown], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `verimind-report-${Date.now()}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    function handleCitationClick(sourceId) {
        if (onSelectSource) {
            onSelectSource(sourceId);
        }
        const el = document.getElementById(`source-card-${sourceId}`);
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("highlight-pulse");
            setTimeout(() => el.classList.remove("highlight-pulse"), 2500);
        }
    }

    // Custom markdown component renderers
    const markdownComponents = {
        p: ({ children, ...props }) => {
            return <p {...props}>{renderWithCitations(children, handleCitationClick)}</p>;
        },
        li: ({ children, ...props }) => {
            return <li {...props}>{renderWithCitations(children, handleCitationClick)}</li>;
        },
        table: ({ ...props }) => (
            <div className="table-responsive">
                <table className="report-table" {...props} />
            </div>
        )
    };

    return (
        <section className="report-card panel">
            <div className="report-header">
                <div className="report-meta">
                    <span className="badge badge-subtle">
                        <FileText size={13} />
                        Synthesized Report
                    </span>
                    {timestamp && (
                        <span className="report-timestamp">
                            <Clock size={13} />
                            {new Date(timestamp).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit"
                            })}
                        </span>
                    )}
                    {usage?.cacheHit && (
                        <span className="badge badge-cache">In-Memory Cache Hit</span>
                    )}
                </div>

                <div className="report-actions">
                    <button
                        type="button"
                        className="btn btn-secondary btn-xs"
                        onClick={handleCopySummary}
                        title="Copy executive summary"
                    >
                        {copiedSummary ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                        <span>{copiedSummary ? "Summary Copied" : "Copy Summary"}</span>
                    </button>

                    <button
                        type="button"
                        className="btn btn-secondary btn-xs"
                        onClick={handleCopyFull}
                        title="Copy complete markdown text"
                    >
                        {copiedFull ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                        <span>{copiedFull ? "Markdown Copied" : "Copy Markdown"}</span>
                    </button>

                    <button
                        type="button"
                        className="btn btn-secondary btn-xs"
                        onClick={handleDownloadReport}
                        title="Download Markdown report file"
                    >
                        <Download size={14} />
                        <span>Export .MD</span>
                    </button>

                    {onRerunFresh && (
                        <button
                            type="button"
                            className="btn btn-ghost btn-xs"
                            onClick={onRerunFresh}
                            title="Re-run research with live web query (bypassing cache)"
                        >
                            <RefreshCw size={13} />
                            <span>Re-run Fresh</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="report-query-banner">
                <span className="query-prefix">RESEARCH QUESTION:</span>
                <h2 className="report-query-text">{query}</h2>
            </div>

            <div className="report-body markdown-content">
                <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={markdownComponents}
                >
                    {answer}
                </ReactMarkdown>
            </div>
        </section>
    );
}

function renderWithCitations(children, onCitationClick) {
    if (!children) return children;

    const citationRegex = /\[(\d+)\]/g;

    function processChild(child) {
        if (typeof child !== "string") {
            if (React.isValidElement(child) && child.props && child.props.children) {
                return React.cloneElement(child, {
                    children: renderWithCitations(child.props.children, onCitationClick)
                });
            }
            return child;
        }

        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = citationRegex.exec(child)) !== null) {
            if (match.index > lastIndex) {
                parts.push(child.slice(lastIndex, match.index));
            }

            const sourceId = parseInt(match[1], 10);
            parts.push(
                <button
                    key={`cite-${match.index}-${sourceId}`}
                    type="button"
                    className="citation-pill"
                    onClick={() => onCitationClick(sourceId)}
                    title={`Jump to Source [${sourceId}]`}
                >
                    [{sourceId}]
                </button>
            );

            lastIndex = match.index + match[0].length;
        }

        if (lastIndex < child.length) {
            parts.push(child.slice(lastIndex));
        }

        return parts.length > 0 ? parts : child;
    }

    if (Array.isArray(children)) {
        return children.map((item, idx) => (
            <React.Fragment key={idx}>{processChild(item)}</React.Fragment>
        ));
    }

    return processChild(children);
}

export default ResearchReport;
