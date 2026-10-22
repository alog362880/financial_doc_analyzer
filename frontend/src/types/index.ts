// TypeScript mirrors of the backend Pydantic response models (app/schemas).

export type DocumentStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";

export type RiskLevel = "Low" | "Medium" | "High" | "Critical";

export type ClauseCategory =
  | "credit_risk"
  | "liquidity_risk"
  | "covenant_breach"
  | "accounting_anomaly"
  | "reporting_discrepancy"
  | "regulatory_compliance"
  | "related_party"
  | "market_risk"
  | "operational_risk"
  | "other";

export type ReportFormat = "csv" | "xlsx";

export const RISK_LEVELS: readonly RiskLevel[] = ["Low", "Medium", "High", "Critical"];

export const CATEGORY_LABELS: Record<ClauseCategory, string> = {
  credit_risk: "Credit risk",
  liquidity_risk: "Liquidity risk",
  covenant_breach: "Covenant breach",
  accounting_anomaly: "Accounting anomaly",
  reporting_discrepancy: "Reporting discrepancy",
  regulatory_compliance: "Regulatory compliance",
  related_party: "Related party",
  market_risk: "Market risk",
  operational_risk: "Operational risk",
  other: "Other",
};

export interface DocumentRead {
  id: string;
  original_filename: string;
  content_type: string;
  size_bytes: number;
  page_count: number | null;
  status: DocumentStatus;
  error_message: string | null;
  created_at: string;
  updated_at: string;
  risk_score: number | null;
  risk_level: RiskLevel | null;
}

export interface FlaggedClause {
  clause_text: string;
  page_number: number | null;
  severity: RiskLevel;
  category: ClauseCategory;
  mitigation_suggestion: string;
  source_verified: boolean;
}

export interface FinancialMetric {
  name: string;
  value: string | null;
  period: string | null;
  covenant_threshold: string | null;
  page_number: number | null;
}

export interface AnalysisResponse {
  document: DocumentRead;
  executive_summary: string;
  risk_score: number;
  risk_level: RiskLevel;
  flagged_clauses: FlaggedClause[];
  financial_metrics: FinancialMetric[];
  llm_provider: string;
  llm_model: string;
  created_at: string;
}

export interface ActivityItem {
  document_id: string;
  filename: string;
  status: DocumentStatus;
  risk_level: RiskLevel | null;
  updated_at: string;
}

export interface DashboardSummary {
  total_documents: number;
  analyzed_documents: number;
  high_risk_documents: number;
  average_risk_score: number | null;
  status_counts: Record<string, number>;
  risk_level_breakdown: Record<string, number>;
  clause_severity_breakdown: Record<string, number>;
  clause_category_breakdown: Record<string, number>;
  recent_activity: ActivityItem[];
}
