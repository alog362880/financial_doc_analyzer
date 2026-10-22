"""API response models and the mapping from ORM objects to them."""

from datetime import datetime

from pydantic import BaseModel

from app.models.document import Document, DocumentStatus
from app.schemas.analysis import FinancialMetric, FlaggedClause, RiskLevel


class DocumentRead(BaseModel):
    id: str
    original_filename: str
    content_type: str
    size_bytes: int
    page_count: int | None
    status: DocumentStatus
    error_message: str | None
    created_at: datetime
    updated_at: datetime
    risk_score: int | None = None
    risk_level: RiskLevel | None = None


class AnalysisResponse(BaseModel):
    document: DocumentRead
    executive_summary: str
    risk_score: int
    risk_level: RiskLevel
    flagged_clauses: list[FlaggedClause]
    financial_metrics: list[FinancialMetric]
    llm_provider: str
    llm_model: str
    created_at: datetime


class ActivityItem(BaseModel):
    document_id: str
    filename: str
    status: DocumentStatus
    risk_level: RiskLevel | None
    updated_at: datetime


class DashboardSummary(BaseModel):
    total_documents: int
    analyzed_documents: int
    high_risk_documents: int
    average_risk_score: float | None
    status_counts: dict[str, int]
    risk_level_breakdown: dict[str, int]
    clause_severity_breakdown: dict[str, int]
    clause_category_breakdown: dict[str, int]
    recent_activity: list[ActivityItem]


def to_document_read(document: Document) -> DocumentRead:
    analysis = document.analysis
    return DocumentRead(
        id=document.id,
        original_filename=document.original_filename,
        content_type=document.content_type,
        size_bytes=document.size_bytes,
        page_count=document.page_count,
        status=DocumentStatus(document.status),
        error_message=document.error_message,
        created_at=document.created_at,
        updated_at=document.updated_at,
        risk_score=analysis.risk_score if analysis else None,
        risk_level=RiskLevel(analysis.risk_level) if analysis else None,
    )
