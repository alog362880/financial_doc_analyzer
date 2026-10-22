import { CheckCircle2, Clock, Loader2, XCircle } from "lucide-react";
import type { DocumentStatus } from "../types";
import { STATUS_LABELS, STATUS_STYLES } from "./riskStyles";

interface StatusBadgeProps {
  status: DocumentStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const Icon = status === "COMPLETED" ? CheckCircle2 : status === "FAILED" ? XCircle : status === "PROCESSING" ? Loader2 : Clock;
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[status]}`}
    >
      <Icon className={`h-3.5 w-3.5 ${status === "PROCESSING" ? "animate-spin" : ""}`} aria-hidden="true" />
      {STATUS_LABELS[status]}
    </span>
  );
}
