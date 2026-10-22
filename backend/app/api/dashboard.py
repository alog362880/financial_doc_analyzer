"""Aggregated metrics for the risk dashboard."""

from fastapi import APIRouter, Query
from sqlalchemy import select

from app.api.deps import SessionDep
from app.models import Document, DocumentStatus
from app.schemas.analysis import ClauseCategory, RiskLevel
from app.schemas.document import ActivityItem, DashboardSummary

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def get_dashboard_summary(
    session: SessionDep,
    recent_limit: int = Query(default=10, ge=1, le=50),
) -> DashboardSummary:
    documents = list((await session.scalars(select(Document).order_by(Document.updated_at.desc()))).all())

    status_counts = {status.value: 0 for status in DocumentStatus}
    risk_breakdown = {level.value: 0 for level in RiskLevel}
    severity_breakdown = {level.value: 0 for level in RiskLevel}
    category_breakdown = {category.value: 0 for category in ClauseCategory}
    scores: list[int] = []

    for document in documents:
        status_counts[document.status] = status_counts.get(document.status, 0) + 1
        analysis = document.analysis
        if analysis is None:
            continue
        scores.append(analysis.risk_score)
        risk_breakdown[analysis.risk_level] = risk_breakdown.get(analysis.risk_level, 0) + 1
        for clause in analysis.flagged_clauses or []:
            severity = clause.get("severity", "")
            category = clause.get("category", "")
            severity_breakdown[severity] = severity_breakdown.get(severity, 0) + 1
            category_breakdown[category] = category_breakdown.get(category, 0) + 1

    recent_activity = [
        ActivityItem(
            document_id=document.id,
            filename=document.original_filename,
            status=DocumentStatus(document.status),
            risk_level=RiskLevel(document.analysis.risk_level) if document.analysis else None,
            updated_at=document.updated_at,
        )
        for document in documents[:recent_limit]
    ]

    return DashboardSummary(
        total_documents=len(documents),
        analyzed_documents=len(scores),
        high_risk_documents=risk_breakdown[RiskLevel.HIGH.value] + risk_breakdown[RiskLevel.CRITICAL.value],
        average_risk_score=round(sum(scores) / len(scores), 1) if scores else None,
        status_counts=status_counts,
        risk_level_breakdown=risk_breakdown,
        clause_severity_breakdown=severity_breakdown,
        clause_category_breakdown=category_breakdown,
        recent_activity=recent_activity,
    )
