"""Text extraction for PDF and TXT uploads, preserving page numbers for citations."""

import asyncio
from dataclasses import dataclass
from pathlib import Path

from pypdf import PdfReader


class DocumentParseError(Exception):
    """Raised when a document cannot be turned into usable text. The message is safe to show to users."""


@dataclass(frozen=True, slots=True)
class PageText:
    number: int
    text: str


@dataclass(frozen=True, slots=True)
class ParsedDocument:
    pages: list[PageText]

    @property
    def page_count(self) -> int:
        return len(self.pages)

    def render_for_prompt(self, max_chars: int) -> tuple[str, bool]:
        """Render pages as tagged blocks. Stops at a page boundary once the budget is reached.

        Returns the rendered text and whether any content was dropped.
        """
        blocks: list[str] = []
        used = 0
        for page in self.pages:
            block = f'<page number="{page.number}">\n{page.text}\n</page>\n'
            if used + len(block) > max_chars:
                if not blocks:
                    blocks.append(block[:max_chars])
                return "".join(blocks), True
            blocks.append(block)
            used += len(block)
        return "".join(blocks), False


def _clean(text: str) -> str:
    return "\n".join(line.rstrip() for line in text.splitlines()).strip()


def _parse_pdf(path: Path) -> list[PageText]:
    try:
        reader = PdfReader(str(path))
        if reader.is_encrypted:
            reader.decrypt("")
        pages = [
            PageText(number=index, text=_clean(page.extract_text() or ""))
            for index, page in enumerate(reader.pages, start=1)
        ]
    except Exception as exc:
        raise DocumentParseError("The PDF could not be read. It may be corrupted or password-protected.") from exc

    if not any(page.text for page in pages):
        raise DocumentParseError("No extractable text was found. Scanned PDFs need OCR before analysis.")
    return pages


def _parse_txt(path: Path) -> list[PageText]:
    raw = path.read_bytes().decode("utf-8", errors="replace")
    # Form feeds mark page breaks in text exports; otherwise the file is treated as one page.
    sections = raw.split("\f") if "\f" in raw else [raw]
    pages = [PageText(number=index, text=_clean(section)) for index, section in enumerate(sections, start=1)]
    if not any(page.text for page in pages):
        raise DocumentParseError("The text file is empty.")
    return pages


async def parse_document(path: Path, suffix: str) -> ParsedDocument:
    """Parse off the event loop, since PDF extraction is CPU-bound."""
    if suffix == ".pdf":
        pages = await asyncio.to_thread(_parse_pdf, path)
    elif suffix == ".txt":
        pages = await asyncio.to_thread(_parse_txt, path)
    else:
        raise DocumentParseError(f"Unsupported file type: {suffix}")
    return ParsedDocument(pages=pages)
