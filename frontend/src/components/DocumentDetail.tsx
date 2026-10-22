import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ArrowLeft, FileText, Loader2 } from "lucide-react";
import { getAnalysis, getDocument } from "../services/api";
import { errorMessage, formatBytes, formatDate } from "../services/format";
import type { AnalysisResponse, DocumentRead, FlaggedClause, RiskLevel } from "../types";
import { RISK_LEVELS } from "../types";
import { RiskCard } from "./RiskCard";
import { RISK_STYLES, SEVERITY_RANK } from "./riskStyles";
import { StatusBadge } from "./StatusBadge";

const POLL_INTERVAL_MS = 2000;

interface DocumentDetailProps {
  documentId: string;
  onBack: () => void;
}

export function DocumentDetail({ documentId, onBack }: DocumentDetailProps) {
  const [doc, setDoc] = useState<DocumentRead | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [severityFilter, setSeverityFilter] = useState<RiskLevel | "ALL">("ALL");

  const status = doc?.status;

  // Poll the document until it leaves PENDING/PROCESSING.
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const tick = async () => {
      try {
        const latest = await getDocument(documentId);
        if (cancelled) {
          return;
        }
        setDoc(latest);
        if (latest.status === "PENDING" || latest.status === "PROCESSING") {
          timer = window.setTimeout(tick, POLL_INTERVAL_MS);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(errorMessage(loadError, "Could not load the document."));
        }
      }
    };

    void tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [documentId]);

  // Fetch the full analysis once the document has completed.
  useEffect(() => {
    if (status !== "COMPLETED") {
      return;
    }
    let cancelled = false;
    getAnalysis(documentId)
      .then((result) => {
        if (!cancelled) {
          setAnalysis(result);
        }
      })
      .catch((analysisError: unknown) => {
        if (!cancelled) {
          setError(errorMessage(analysisError, "Could not load the analysis."));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [documentId, status]);

  const sortedClauses = useMemo<FlaggedClause[]>(() => {
    const clauses = analysis?.flagged_clauses ?? [];
    return [...clauses].sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);
  }, [analysis]);

  const visibleClauses = severityFilter === "ALL" ? sortedClauses : sortedClauses.filter((clause) => clause.severity === severityFilter);

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to documents
      </button>

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!doc && !error && (
        <div className="flex justify-center py-24 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
        </div>
      )}

      {doc && (
        <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
          {/* Left pane: document metadata and summary */}
          <aside className="space-y-5 lg:sticky lg:top-24 lg:self-start">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <FileText className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" aria-hidden="true" />
                <div className="min-w-0">
                  <h2 className="break-words text-base font-semibold text-slate-900">{doc.original_filename}</h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {formatBytes(doc.size_bytes)}
                    {doc.page_count !== null && ` · ${doc.page_count} page${doc.page_count === 1 ? "" : "s"}`}
                  </p>
                </div>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Status</dt>
                  <dd className="mt-1">
                    <StatusBadge status={doc.status} />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Uploaded</dt>
                  <dd className="mt-1 text-slate-800">{formatDate(doc.created_at)}</dd>
                </div>
              </dl>
            </div>

            {(doc.status === "PENDING" || doc.status === "PROCESSING") && (
              <div className="flex items-center gap-3 rounded-xl border border-blue-200 bg-blue-50 p-5 text-sm text-blue-800">
                <Loader2 className="h-5 w-5 shrink-0 animate-spin" aria-hidden="true" />
                <span>Analysis in progress. This view updates automatically.</span>
              </div>
            )}

            {doc.status === "FAILED" && (
              <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
                <span>{doc.error_message ?? "Processing failed."}</span>
              </div>
            )}

            {analysis && (
              <>
                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-end justify-between">
                    <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Risk score</span>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${RISK_STYLES[analysis.risk_level].badge}`}>
                      {analysis.risk_level}
                    </span>
                  </div>
                  <p className="mt-2 text-4xl font-semibold tabular-nums text-slate-900">
                    {analysis.risk_score}
                    <span className="text-lg font-normal text-slate-400"> / 100</span>
                  </p>
                  <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                    <div className={`h-full rounded-full ${RISK_STYLES[analysis.risk_level].bar}`} style={{ width: `${analysis.risk_score}%` }} />
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-900">Executive summary</h3>
                  <p className="mt-2 text-sm leading-relaxed text-slate-700">{analysis.executive_summary}</p>
                  <p className="mt-3 text-xs text-slate-400">
                    Model: {analysis.llm_provider} / {analysis.llm_model}
                  </p>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                  <h3 className="text-sm font-semibold text-slate-900">Financial metrics</h3>
                  {analysis.financial_metrics.length === 0 ? (
                    <p className="mt-2 text-sm text-slate-500">No metrics stated in the document.</p>
                  ) : (
                    <ul className="mt-3 divide-y divide-slate-100">
                      {analysis.financial_metrics.map((metric, index) => (
                        <li key={`${metric.name}-${index}`} className="py-2.5 text-sm">
                          <div className="flex items-baseline justify-between gap-3">
                            <span className="text-slate-600">{metric.name}</span>
                            <span className="font-semibold tabular-nums text-slate-900">{metric.value ?? "Not stated"}</span>
                          </div>
                          {(metric.period || metric.covenant_threshold || metric.page_number !== null) && (
                            <p className="mt-0.5 text-xs text-slate-500">
                              {[
                                metric.period && `Period: ${metric.period}`,
                                metric.covenant_threshold && `Covenant: ${metric.covenant_threshold}`,
                                metric.page_number !== null && `Page ${metric.page_number}`,
                              ]
                                .filter(Boolean)
                                .join(" · ")}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </>
            )}
          </aside>

          {/* Right pane: interactive risk cards */}
          <section className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="mr-2 text-base font-semibold text-slate-900">Flagged clauses</h2>
              {(["ALL", ...RISK_LEVELS] as const).map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setSeverityFilter(level)}
                  aria-pressed={severityFilter === level}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    severityFilter === level ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {level === "ALL" ? `All (${sortedClauses.length})` : level}
                </button>
              ))}
            </div>

            {!analysis && doc.status === "COMPLETED" && (
              <p className="py-12 text-center text-sm text-slate-500">Loading findings...</p>
            )}
            {analysis && visibleClauses.length === 0 && (
              <p className="rounded-xl border border-dashed border-slate-300 bg-white py-12 text-center text-sm text-slate-500">
                {sortedClauses.length === 0
                  ? "No risky clauses were flagged in this document."
                  : "No clauses match this severity filter."}
              </p>
            )}
            {visibleClauses.map((clause, index) => (
              <RiskCard key={`${clause.page_number ?? "x"}-${index}-${clause.clause_text.slice(0, 24)}`} clause={clause} index={index} />
            ))}
          </section>
        </div>
      )}
    </div>
  );
}
