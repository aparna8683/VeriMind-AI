import React from "react";
import { X, BookOpen, AlertTriangle } from "lucide-react";

export function MethodologyModal({ isOpen, onClose }) {
    if (!isOpen) return null;

    return (
        <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
            <div className="modal-container" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <div className="modal-header-title">
                        <BookOpen size={20} className="modal-icon" />
                        <div>
                            <h3>Research Methodology & System Limitations</h3>
                            <p>How VeriMind AI verifies information and where boundaries exist</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        className="btn btn-icon btn-sm"
                        onClick={onClose}
                        title="Close modal"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="modal-body">
                    {/* The 7 Steps */}
                    <div className="methodology-section">
                        <h4>The 7-Step Evidence Verification Pipeline</h4>

                        <div className="pipeline-walkthrough">
                            <div className="walkthrough-step">
                                <div className="step-badge">1</div>
                                <div>
                                    <strong>Multi-Source Web Retrieval</strong>
                                    <p>Tavily queries the live web for authoritative documents, capturing raw content, page titles, URLs, and search relevance rankings.</p>
                                </div>
                            </div>

                            <div className="walkthrough-step">
                                <div className="step-badge">2</div>
                                <div>
                                    <strong>Evidence Synthesis & Grounded Drafting</strong>
                                    <p>Groq (Llama-3.3-70B) synthesizes an editorial research report constrained strictly to the retrieved source corpus, citing explicit bracketed references [1], [2].</p>
                                </div>
                            </div>

                            <div className="walkthrough-step">
                                <div className="step-badge">3</div>
                                <div>
                                    <strong>Atomic Factual Claim Extraction</strong>
                                    <p>The Claim Extractor isolates checkable factual assertions (quantities, dates, mechanisms, historical events), discarding opinions, speculation, and detecting compound assertions.</p>
                                </div>
                            </div>

                            <div className="walkthrough-step">
                                <div className="step-badge">4</div>
                                <div>
                                    <strong>Verbatim Excerpt Cross-Examination</strong>
                                    <p>The Claim Verifier inspects claims against source text. Every determination (supported, contradicted, insufficient) requires a verbatim quotation validated against source text.</p>
                                </div>
                            </div>

                            <div className="walkthrough-step">
                                <div className="step-badge">5</div>
                                <div>
                                    <strong>Targeted Gap-Filling (Claim-Level Retrieval)</strong>
                                    <p>Claims marked with insufficient evidence trigger a focused web search within the session budget to discover missing primary sources and re-evaluate the claim.</p>
                                </div>
                            </div>

                            <div className="walkthrough-step">
                                <div className="step-badge">6</div>
                                <div>
                                    <strong>Source Quality Classification</strong>
                                    <p>Sources are classified by institutional profile (government, academic, documentation, independent journalism, industry analysis, vendor blog) with transparent rationales.</p>
                                </div>
                            </div>

                            <div className="walkthrough-step">
                                <div className="step-badge">7</div>
                                <div>
                                    <strong>Human-in-the-Loop Audit Protocol</strong>
                                    <p>Flags unresolved or contradictory items for human review, documenting what evidence was found, what remains missing, and recommended next steps.</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Epistemological & Technical Limitations */}
                    <div className="methodology-section limitations-box">
                        <div className="limitations-title">
                            <AlertTriangle size={18} className="text-warning" />
                            <h4>Important Limitations & Scientific Caveats</h4>
                        </div>
                        <ul>
                            <li>
                                <strong>Corroboration is not absolute truth:</strong> A claim supported by web sources reflects agreement in the retrieved text, but does not guarantee real-world truth or consensus.
                            </li>
                            <li>
                                <strong>Search coverage limits:</strong> Search engines can miss niche scientific papers, paywalled journals, or newly emerging breaking updates.
                            </li>
                            <li>
                                <strong>LLM semantic drift:</strong> Language models can occasionally misinterpret nuanced statistical qualifiers, causal directions, or conditional phrasing.
                            </li>
                            <li>
                                <strong>Free-tier budget boundaries:</strong> To operate at zero cost, queries, claims, and re-verification iterations are strictly bounded to prevent API quota exhaustion.
                            </li>
                            <li>
                                <strong>Contradictions demand human judgment:</strong> When credible sources disagree, automated agents can only report the conflict; human researchers must weigh methodologies.
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="modal-footer">
                    <button type="button" className="btn btn-primary btn-sm" onClick={onClose}>
                        I Understand & Agree
                    </button>
                </div>
            </div>
        </div>
    );
}

export default MethodologyModal;
