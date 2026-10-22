import { useCallback, useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Activity, CheckCircle2, FileSpreadsheet, FileText, Gauge, Download, Loader2, ShieldAlert } from "lucide-react";
import { downloadReport, getDashboardSummary } from "../services/api";
import { errorMessage, formatDate } from "../services/format";
import type { DashboardSummary, ReportFormat } from "../types";
import { RISK_LEVELS } from "../types";
import { MetricsChart, type ChartDatum } from "./MetricsChart";
import { RISK_STYLES } from "./riskStyles";
import { StatusBadge } from "./StatusBadge";

const REFRESH_INTERVAL_MS = 5000;

interface DashboardProps {
  onSelectDocument: (documentId: string) => void;
}

export function Dashboard({ onSelectDocument }: DashboardProps) {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [exporting, setExporting] = useState<ReportFormat | null>(null);

  const load = useCallback(async () => {
    try {
      setSummary(await getDashboardSummary());
      setError(null);
    } catch (loadError) {
      setError(errorMessage(loadError, "Could not load the dashboard."));
    }
  }, []);

  // Refresh on an interval so the dashboard reflects documents that finish in the background.
  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const handleExport = async (format: ReportFormat) => {
    setExporting(format);
    setError(null);
    try {
      await downloadReport(format);
    } catch (exportError) {
      setError(errorMessage(exportError, "Export failed."));
    } finally {
      setExporting(null);
    }
  };

  if (!summary) {
    return (
      <div className="flex items-center justify-center gap-2 py-24 text-slate-500">
        {error ? <span className="text-red-600">{error}</span> : <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />}
      </div>
    );
  }

  const riskData: ChartDatum[] = RISK_LEVELS.map((level) => ({
    name: level,
    value: summary.risk_level_breakdown[level] ?? 0,
    color: RISK_STYLES[level].chart,
  }));
  const severityData: ChartDatum[] = RISK_LEVELS.map((level) => ({
    name: level,
    value: summary.clause_severity_breakdown[level] ?? 0,
    color: RISK_STYLES[level].chart,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg font-semibold text-slate-900">Risk overview</h2>
        <div className="ml-auto flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void handleExport("xlsx")}
            disabled={exporting !== null}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {exporting === "xlsx" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />}
            Export Excel
          </button>
          <button
            type="button"
            onClick={() => void handleExport("csv")}
            disabled={exporting !== null}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-sm font-medium text-slate-700 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 disabled:opacity-60"
          >
            {exporting === "csv" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Download className="h-4 w-4" aria-hidden="true" />}
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={FileText} label="Total documents" value={summary.total_documents.toString()} tone="text-slate-700" />
        <StatCard
          icon={CheckCircle2}
          label="Analyzed"
          value={summary.analyzed_documents.toString()}
          tone="text-emerald-600"
        />
        <StatCard icon={ShieldAlert} label="High-risk documents" value={summary.high_risk_documents.toString()} tone="text-red-600" />
        <StatCard
          icon={Gauge}
          label="Average risk score"
          value={summary.average_risk_score === null ? "—" : summary.average_risk_score.toFixed(1)}
          tone="text-orange-600"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <MetricsChart title="Documents by risk level" data={riskData} emptyMessage="No analyzed documents yet" />
        <MetricsChart title="Flagged clauses by severity" data={severityData} emptyMessage="No flagged clauses yet" />
      </div>

      <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2 border-b border-slate-200 px-5 py-4">
          <Activity className="h-4 w-4 text-slate-500" aria-hidden="true" />
          <h3 className="text-sm font-semibold text-slate-900">Recent activity</h3>
        </div>
        {summary.recent_activity.length === 0 ? (
          <p className="px-5 py-8 text-center text-sm text-slate-500">No activity yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {summary.recent_activity.map((item) => (
              <li key={item.document_id}>
                <button
                  type="button"
                  onClick={() => onSelectDocument(item.document_id)}
                  className="flex w-full flex-wrap items-center gap-3 px-5 py-3 text-left hover:bg-slate-50"
                >
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-900">{item.filename}</span>
                  <StatusBadge status={item.status} />
                  {item.risk_level && (
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${RISK_STYLES[item.risk_level].badge}`}>
                      {item.risk_level}
                    </span>
                  )}
                  <span className="whitespace-nowrap text-xs text-slate-500">{formatDate(item.updated_at)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

interface StatCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  tone: string;
}

function StatCard({ icon: Icon, label, value, tone }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
        <Icon className={`h-5 w-5 ${tone}`} aria-hidden="true" />
      </div>
      <p className="mt-3 text-3xl font-semibold tabular-nums text-slate-900">{value}</p>
    </div>
  );
}
