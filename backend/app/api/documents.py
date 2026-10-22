"""Document ingestion, status listing and analysis retrieval endpoints."""

import asyncio
import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, File, HTTPException, Query, UploadFile, status
from sqlalchemy import select

from app.api.deps import SessionDep
from app.core.config import get_settings
from app.core.security import (
    ALLOWED_EXTENSIONS,
    read_upload_bounded,
    resolve_extension,
    sanitize_filename,
    validate_content,
)
from app.models import Document, DocumentStatus
from app.schemas.analysis import FinancialMetric, FlaggedClause, RiskLevel
from app.schemas.document import AnalysisResponse, DocumentRead, to_document_read
from app.services.analysis_service import process_document

router = APIRouter(prefix="/documents", tags=["documents"])


async def _load_document(session: SessionDep, document_id: str) -> Document:
    document = await session.get(Document, document_id)
    if document is None:
        raise HTTPException(status_code=404, detail="Document not found")
    return document


@router.post("/upload", response_model=DocumentRead, status_code=status.HTTP_202_ACCEPTED)
async def upload_document(
    background_tasks: BackgroundTasks,
    session: SessionDep,
    file: Annotated[UploadFile, File()],
) -> DocumentRead:
    settings = get_settings()
    original_name = sanitize_filename(file.filename or "")
    extension = resolve_extension(original_name)
    content = await read_upload_bounded(file, settings.max_upload_bytes)
    if not content:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")
    validate_content(extension, content)

    # Store under a random name so user-supplied filenames never touch the filesystem path.
    stored_path = settings.upload_dir / f"{uuid.uuid4().hex}{extension}"
    await asyncio.to_thread(stored_path.write_bytes, content)

    document = Document(
        original_filename=original_name,
        stored_path=str(stored_path),
        content_type=ALLOWED_EXTENSIONS[extension],
        size_bytes=len(content),
        status=DocumentStatus.PENDING.value,
    )
    session.add(document)
    await session.commit()
    await session.refresh(document)

    background_tasks.add_task(process_document, document.id)
    return to_document_read(document)


@router.get("/", response_model=list[DocumentRead])
async def list_documents(
    session: SessionDep,
    status_filter: Annotated[DocumentStatus | None, Query(alias="status")] = None,
    skip: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=200)] = 50,
) -> list[DocumentRead]:
    statement = select(Document).order_by(Document.created_at.desc()).offset(skip).limit(limit)
    if status_filter is not None:
        statement = statement.where(Document.status == status_filter.value)
    result = await session.scalars(statement)
    return [to_document_read(document) for document in result]


@router.get("/{document_id}", response_model=DocumentRead)
async def get_document(document_id: str, session: SessionDep) -> DocumentRead:
    document = await _load_document(session, document_id)
    return to_document_read(document)


@router.get("/{document_id}/analysis", response_model=AnalysisResponse)
async def get_document_analysis(document_id: str, session: SessionDep) -> AnalysisResponse:
    document = await _load_document(session, document_id)
    analysis = document.analysis
    if analysis is None:
        if document.status == DocumentStatus.FAILED.value:
            raise HTTPException(status_code=422, detail=document.error_message or "Analysis failed.")
        raise HTTPException(status_code=409, detail="Analysis is not available yet.")

    return AnalysisResponse(
        document=to_document_read(document),
        executive_summary=analysis.executive_summary,
        risk_score=analysis.risk_score,
        risk_level=RiskLevel(analysis.risk_level),
        flagged_clauses=[FlaggedClause.model_validate(clause) for clause in analysis.flagged_clauses],
        financial_metrics=[FinancialMetric.model_validate(metric) for metric in analysis.financial_metrics],
        llm_provider=analysis.llm_provider,
        llm_model=analysis.llm_model,
        created_at=analysis.created_at,
    )
