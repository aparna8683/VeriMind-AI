import React from "react";
import {
    X,
    Trash2,
    Clock,
    History,
    ArrowRight
} from "lucide-react";

export function ResearchHistoryDrawer({
    isOpen,
    onClose,
    history = [],
    onSelectHistoryItem,
    onDeleteItem,
    onClearAll
}) {
    if (!isOpen) return null;

    return (
        <div className="drawer-backdrop" onClick={onClose} role="dialog" aria-modal="true">
            <aside className="drawer-panel" onClick={(e) => e.stopPropagation()}>
                <div className="drawer-header">
                    <div className="drawer-title-group">
                        <History size={18} />
                        <h3>Local Research History</h3>
                    </div>

                    <div className="drawer-header-actions">
                        {history.length > 0 && (
                            <button
                                type="button"
                                className="btn btn-ghost btn-xs text-danger"
                                onClick={onClearAll}
                                title="Clear all local history"
                            >
                                <Trash2 size={13} />
                                <span>Clear All</span>
                            </button>
                        )}
                        <button
                            type="button"
                            className="btn btn-icon btn-sm"
                            onClick={onClose}
                            title="Close drawer"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                <div className="drawer-notice">
                    <span>Stored entirely on your local browser (zero remote storage cost).</span>
                </div>

                <div className="drawer-body">
                    {history.length === 0 ? (
                        <div className="drawer-empty-state">
                            <History size={32} className="text-muted" />
                            <h4>No local investigations yet</h4>
                            <p>Completed research reports will automatically be preserved here for instant offline inspection.</p>
                        </div>
                    ) : (
                        <div className="history-list">
                            {history.map((item) => (
                                <article
                                    key={item.id}
                                    className="history-card"
                                    onClick={() => onSelectHistoryItem(item)}
                                >
                                    <div className="history-card-header">
                                        <span className="history-date">
                                            <Clock size={12} />
                                            {new Date(item.timestamp).toLocaleDateString(undefined, {
                                                month: "short",
                                                day: "numeric",
                                                hour: "2-digit",
                                                minute: "2-digit"
                                            })}
                                        </span>

                                        <button
                                            type="button"
                                            className="btn btn-icon btn-xs delete-item-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onDeleteItem(item.id);
                                            }}
                                            title="Delete this history item"
                                        >
                                            <Trash2 size={13} />
                                        </button>
                                    </div>

                                    <h4 className="history-query-text">{item.query}</h4>

                                    <div className="history-card-footer">
                                        <div className="history-stats">
                                            <span className="pill-claims">{item.totalClaims} Claims</span>
                                            <span className={`pill-support support-${item.assessment}`}>
                                                {item.supportRate}% Supported
                                            </span>
                                        </div>

                                        <span className="history-open-action">
                                            <span>Open</span>
                                            <ArrowRight size={13} />
                                        </span>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>
            </aside>
        </div>
    );
}

export default ResearchHistoryDrawer;
