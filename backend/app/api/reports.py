"""Audit report export (CSV or Excel)."""

import asyncio
from datetime import datetime, timezone
from typing import Annotated, Literal

from fastapi import APIRouter, Query, Response
from sqlalchemy import select

from app.api.deps import SessionDep
from app.models import Document
from app.services.report_service import (
    CLAUSE_HEADERS,
    build_report_tables,
    render_csv,
    render_xlsx,
)

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/export")
async def export_report(
    session: SessionDep,
    report_format: Annotated[Literal["csv", "xlsx"], Query(alias="format")] = "xlsx",
) -> Response:
    documents = list((await session.scalars(select(Document).order_by(Document.created_at.desc()))).all())
    tables = build_report_tables(documents)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")

    if report_format == "csv":
        content = render_csv(CLAUSE_HEADERS, tables.clauses)
        media_type = "text/csv; charset=utf-8"
        filename = f"audit_report_{stamp}.csv"
    else:
        content = await asyncio.to_thread(render_xlsx, tables)
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"audit_report_{stamp}.xlsx"

    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
