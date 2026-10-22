import { Lightbulb, ShieldAlert, ShieldCheck } from "lucide-react";
import { CATEGORY_LABELS, type FlaggedClause } from "../types";
import { RISK_STYLES } from "./riskStyles";

interface RiskCardProps {
  clause: FlaggedClause;
  index: number;
}

export function RiskCard({ clause, index }: RiskCardProps) {
  const style = RISK_STYLES[clause.severity];
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold text-slate-400">#{index + 1}</span>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${style.badge}`}>
          {clause.severity}
        </span>
        <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-700">
          {CATEGORY_LABELS[clause.category]}
        </span>
        <span className="ml-auto text-xs text-slate-500">
          {clause.page_number !== null ? `Page ${clause.page_number}` : "Page unknown"}
        </span>
      </header>

      <blockquote className="mt-3 break-words border-l-4 border-slate-300 pl-3 text-sm italic text-slate-700">
        &ldquo;{clause.clause_text}&rdquo;
      </blockquote>

      <p className="mt-3 flex items-start gap-2 text-sm text-slate-600">
        <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden="true" />
        <span>{clause.mitigation_suggestion}</span>
      </p>

      <footer className="mt-3 flex items-center gap-1.5 text-xs">
        {clause.source_verified ? (
          <>
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
            <span className="text-emerald-700">Quotation found in source text</span>
          </>
        ) : (
          <>
            <ShieldAlert className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
            <span className="text-amber-700">Quotation not matched; verify manually</span>
          </>
        )}
      </footer>
    </article>
  );
}
