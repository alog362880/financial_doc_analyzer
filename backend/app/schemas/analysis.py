"""Pydantic models that define the LLM's structured output and the risk classification rules.

`FinancialAnalysis` is the single source of truth for the model output:
- Anthropic receives its JSON Schema as a forced tool-input schema.
- Gemini receives it as `response_schema` with JSON response MIME type.
Both responses are re-validated with Pydantic before anything is persisted.
"""

from enum import Enum

from pydantic import BaseModel, Field, field_validator


class RiskLevel(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"
    CRITICAL = "Critical"


class ClauseCategory(str, Enum):
    CREDIT_RISK = "credit_risk"
    LIQUIDITY_RISK = "liquidity_risk"
    COVENANT_BREACH = "covenant_breach"
    ACCOUNTING_ANOMALY = "accounting_anomaly"
    REPORTING_DISCREPANCY = "reporting_discrepancy"
    REGULATORY_COMPLIANCE = "regulatory_compliance"
    RELATED_PARTY = "related_party"
    MARKET_RISK = "market_risk"
    OPERATIONAL_RISK = "operational_risk"
    OTHER = "other"


class ExtractedClause(BaseModel):
    """A risky clause as returned by the LLM (before server-side grounding)."""

    clause_text: str = Field(
        description="Verbatim quotation copied character-for-character from the document. Maximum 400 characters."
    )
    page_number: int | None = Field(
        default=None,
        description="Number attribute of the <page> block that contains the quotation, or null if unknown.",
    )
    severity: RiskLevel = Field(description="One of: Low, Medium, High, Critical.")
    category: ClauseCategory = Field(description="The best-matching risk category.")
    mitigation_suggestion: str = Field(
        description="One practical, generic recommendation. Maximum 300 characters. This is advice, not a document fact."
    )


class FlaggedClause(ExtractedClause):
    """A stored flagged clause. `source_verified` is set by the server, never by the LLM."""

    source_verified: bool = Field(
        default=False,
        description="True when the quotation was found in the extracted source text.",
    )


class FinancialMetric(BaseModel):
    name: str = Field(
        description="Metric label as written in the document, e.g. 'Leverage Ratio', 'EBITDA', 'Interest Coverage'."
    )
    value: str | None = Field(
        default=None,
        description="Value exactly as stated, including units, e.g. '3.5x' or '$12.4 million'. Null if not stated.",
    )
    period: str | None = Field(default=None, description="Reporting period or test date as stated, or null.")
    covenant_threshold: str | None = Field(
        default=None,
        description="Covenant limit stated in the document for this metric, or null.",
    )
    page_number: int | None = Field(default=None, description="Page where the value appears, or null.")


class FinancialAnalysis(BaseModel):
    """Structured output the LLM must produce for each document."""

    executive_summary: str = Field(
        description="Two to three factual sentences on the document's financial position and key risks."
    )
    risk_score: int = Field(
        description="Integer from 0 (no material risk) to 100 (severe, imminent default, fraud or regulatory action)."
    )
    flagged_clauses: list[ExtractedClause] = Field(
        default_factory=list,
        description="Clauses or statements that present a risk or anomaly the text supports. Empty list if none.",
    )
    financial_metrics: list[FinancialMetric] = Field(
        default_factory=list,
        description="Financial ratios and figures explicitly stated in the document.",
    )

    @field_validator("risk_score")
    @classmethod
    def _clamp_risk_score(cls, value: int) -> int:
        return max(0, min(100, value))


def risk_level_for_score(score: int) -> RiskLevel:
    """Deterministic classification so the level is consistent regardless of what the model says."""
    if score >= 75:
        return RiskLevel.CRITICAL
    if score >= 50:
        return RiskLevel.HIGH
    if score >= 25:
        return RiskLevel.MEDIUM
    return RiskLevel.LOW
