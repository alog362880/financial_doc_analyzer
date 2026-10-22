import { useCallback, useEffect, useState } from "react";
import { listDocuments } from "../services/api";
import { errorMessage, formatBytes, formatDate } from "../services/format";
import type { DocumentRead, DocumentStatus } from "../types";
import { RISK_STYLES } from "./riskStyles";
import { StatusBadge } from "./StatusBadge";

const FILTERS: ReadonlyArray<{ label: string; value: DocumentStatus | "ALL" }> = [
  { label: "All", value: "ALL" },
  { label: "Processing", value: "PROCESSING" },
  { label: "Completed", value: "COMPLETED" },
  { label: "Failed", value: "FAILED" },
];

const ACTIVE_STATUSES: ReadonlySet<DocumentStatus> = new Set<DocumentStatus>(["PENDING", "PROCESSING"]);
const POLL_INTERVAL_MS = 2000;

interface DocumentListProps {
  refreshKey: number;
  onSelectDocument: (documentId: string) => void;
}

export function DocumentList({ refreshKey, onSelectDocument }: DocumentListProps) {
  const [documents, setDocuments] = useState<DocumentRead[]>([]);
  const [filter, setFilter] = useState<DocumentStatus | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await listDocuments(filter === "ALL" ? undefined : filter);
      setDocuments(data);
      setError(null);
    } catch (loadError) {
      setError(errorMessage(loadError, "Could not load documents."));
    } finally {
      setLoading(false);
    }
  }, [filter]);

  // Reload on filter change and whenever a parent signals a new upload (refreshKey).
  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  // While any document is still queued or processing, keep polling so statuses update live.
  const hasActive = documents.some((doc) => ACTIVE_STATUSES.has(doc.status));
  useEffect(() => {
    if (!hasActive) {
      return;
    }
    const timer = window.setInterval(() => void load(), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [hasActive, load]);

  return (
    <section className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            aria-pressed={filter === item.value}
            className={`rounded-full px-3 py-1 text-xs font-medium transition ${
              filter === item.value ? "bg-slate-900 text-white" : "bg-white text-slate-600 ring-1 ring-inset ring-slate-300 hover:bg-slate-50"
            }`}
          >
            {item.label}
          </button>
        ))}
        {hasActive && <span className="ml-auto text-xs text-slate-500">Live updates on</span>}
      </div>

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Document</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Risk</th>
              <th className="px-4 py-3 font-semibold">Pages</th>
              <th className="px-4 py-3 font-semibold">Size</th>
              <th className="px-4 py-3 font-semibold">Uploaded</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading && documents.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  Loading documents...
                </td>
              </tr>
            )}
            {!loading && documents.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                  No documents yet. Upload a PDF or TXT file to start.
                </td>
              </tr>
            )}
            {documents.map((doc) => (
              <tr key={doc.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">
                  <button
                    type="button"
                    onClick={() => onSelectDocument(doc.id)}
                    className="max-w-[16rem] truncate text-left font-medium text-blue-700 hover:underline"
                  >
                    {doc.original_filename}
                  </button>
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={doc.status} />
                </td>
                <td className="px-4 py-3">
                  {doc.risk_score !== null && doc.risk_level !== null ? (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${RISK_STYLES[doc.risk_level].badge}`}>
                      {doc.risk_score} · {doc.risk_level}
                    </span>
                  ) : (
                    <span className="text-slate-400">&mdash;</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">{doc.page_count ?? "—"}</td>
                <td className="px-4 py-3 text-slate-600">{formatBytes(doc.size_bytes)}</td>
                <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDate(doc.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
