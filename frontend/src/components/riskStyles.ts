import type { DocumentStatus, RiskLevel } from "../types";

// Tailwind classes plus a hex colour for Recharts, kept together so the palette stays consistent.
export const RISK_STYLES: Record<RiskLevel, { badge: string; bar: string; chart: string }> = {
  Low: {
    badge: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    bar: "bg-emerald-500",
    chart: "#10b981",
  },
  Medium: {
    badge: "bg-amber-50 text-amber-700 ring-amber-600/20",
    bar: "bg-amber-500",
    chart: "#f59e0b",
  },
  High: {
    badge: "bg-orange-50 text-orange-700 ring-orange-600/20",
    bar: "bg-orange-500",
    chart: "#f97316",
  },
  Critical: {
    badge: "bg-red-50 text-red-700 ring-red-600/20",
    bar: "bg-red-600",
    chart: "#dc2626",
  },
};

export const STATUS_STYLES: Record<DocumentStatus, string> = {
  PENDING: "bg-slate-100 text-slate-700 ring-slate-500/20",
  PROCESSING: "bg-blue-50 text-blue-700 ring-blue-600/20",
  COMPLETED: "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
  FAILED: "bg-red-50 text-red-700 ring-red-600/20",
};

export const STATUS_LABELS: Record<DocumentStatus, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  COMPLETED: "Completed",
  FAILED: "Failed",
};

export const SEVERITY_RANK: Record<RiskLevel, number> = {
  Low: 0,
  Medium: 1,
  High: 2,
  Critical: 3,
};
