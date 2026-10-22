"""Background pipeline: parse -> analyze with the LLM -> ground citations -> persist."""

import logging
import re
from pathlib import Path

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.models import Analysis, Document, DocumentStatus
from app.schemas.analysis import ExtractedClause, FlaggedClause, risk_level_for_score
from app.services.llm_base import LLMError
from app.services.llm_router import get_llm_router
from app.services.parser import DocumentParseError, ParsedDocument, parse_document
from app.services.prompts import SYSTEM_PROMPT, build_user_prompt

logger = logging.getLogger(__name__)

_WHITESPACE = re.compile(r"\s+")


def _normalize(text: str) -> str:
    return _WHITESPACE.sub(" ", text).strip().lower()


def ground_clauses(clauses: list[ExtractedClause], parsed: ParsedDocument) -> list[FlaggedClause]:
    """Check each quotation against the source text.

    Quotes that are found are marked `source_verified`. If the model cited the wrong page, the page is corrected
    to where the quote actually appears. Quotes that cannot be found are kept but marked unverified, so reviewers
    can see them.
    """
    pages = {page.number: _normalize(page.text) for page in parsed.pages}
    grounded: list[FlaggedClause] = []
    for clause in clauses:
        needle = _normalize(clause.clause_text)
        page_number = clause.page_number if clause.page_number in pages else None
        verified = False
        if needle:
            if page_number is not None and needle in pages[page_number]:
                verified = True
            else:
                for number, haystack in pages.items():
                    if needle in haystack:
                        page_number, verified = number, True
                        break
        grounded.append(
            FlaggedClause(
                **clause.model_dump(exclude={"page_number"}),
                page_number=page_number,
                source_verified=verified,
            )
        )
    return grounded


async def process_document(document_id: str) -> None:
    """Run the full pipeline for one document. Runs as a FastAPI background task with its own session."""
    settings = get_settings()

    async with SessionLocal() as session:
        document = await session.get(Document, document_id)
        if document is None:
            logger.error("Background task skipped: document %s not found", document_id)
            return

        document.status = DocumentStatus.PROCESSING.value
        document.error_message = None
        await session.commit()

        try:
            parsed = await parse_document(Path(document.stored_path), Path(document.stored_path).suffix.lower())
            document.page_count = parsed.page_count

            rendered, truncated = parsed.render_for_prompt(settings.max_document_chars)
            if truncated:
                logger.info("Document %s truncated to %d chars for analysis", document_id, settings.max_document_chars)
            user_prompt = build_user_prompt(
                filename=document.original_filename,
                page_count=parsed.page_count,
                rendered_pages=rendered,
                truncated=truncated,
            )

            outcome = await get_llm_router().analyze(SYSTEM_PROMPT, user_prompt)
            clauses = ground_clauses(outcome.analysis.flagged_clauses, parsed)
            unverified = sum(1 for clause in clauses if not clause.source_verified)
            if unverified:
                logger.warning("Document %s has %d unverified clause quotation(s)", document_id, unverified)

            session.add(
                Analysis(
                    document_id=document.id,
                    executive_summary=outcome.analysis.executive_summary,
                    risk_score=outcome.analysis.risk_score,
                    risk_level=risk_level_for_score(outcome.analysis.risk_score).value,
                    flagged_clauses=[clause.model_dump(mode="json") for clause in clauses],
                    financial_metrics=[metric.model_dump(mode="json") for metric in outcome.analysis.financial_metrics],
                    llm_provider=outcome.provider,
                    llm_model=outcome.model,
                )
            )
            document.status = DocumentStatus.COMPLETED.value
            await session.commit()
            logger.info("Document %s analyzed by %s (%s)", document_id, outcome.provider, outcome.model)
            return
        except DocumentParseError as exc:
            failure_message = str(exc)
        except LLMError as exc:
            logger.error("LLM analysis failed for document %s: %s", document_id, exc)
            failure_message = f"AI analysis failed: {exc}"
        except Exception:
            logger.exception("Unexpected failure while processing document %s", document_id)
            failure_message = "Unexpected error while processing the document."

        await session.rollback()
        document = await session.get(Document, document_id)
        if document is not None:
            document.status = DocumentStatus.FAILED.value
            document.error_message = failure_message
            await session.commit()
