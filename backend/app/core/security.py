"""Upload hardening: filename sanitising, extension allow-list, bounded reads and content checks."""

import re
from pathlib import Path

from fastapi import HTTPException, UploadFile

ALLOWED_EXTENSIONS: dict[str, str] = {
    ".pdf": "application/pdf",
    ".txt": "text/plain",
}

_UNSAFE_FILENAME_CHARS = re.compile(r"[^A-Za-z0-9._ -]")
_READ_CHUNK_BYTES = 1024 * 1024


def sanitize_filename(filename: str) -> str:
    """Strip any directory components and replace unsafe characters."""
    base = Path(filename.replace("\\", "/")).name
    cleaned = _UNSAFE_FILENAME_CHARS.sub("_", base).strip(" .")
    return cleaned[:200] or "document"


def resolve_extension(filename: str) -> str:
    extension = Path(filename).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=415,
            detail="Unsupported file type. Upload a PDF or TXT file.",
        )
    return extension


async def read_upload_bounded(upload: UploadFile, max_bytes: int) -> bytes:
    """Read an upload while enforcing a hard size limit, so oversized files are never fully buffered."""
    buffer = bytearray()
    while chunk := await upload.read(_READ_CHUNK_BYTES):
        buffer.extend(chunk)
        if len(buffer) > max_bytes:
            raise HTTPException(
                status_code=413,
                detail=f"File exceeds the {max_bytes // (1024 * 1024)} MB upload limit.",
            )
    return bytes(buffer)


def validate_content(extension: str, content: bytes) -> None:
    """Check the file body matches its claimed type (magic bytes for PDF, no binary data in TXT)."""
    if extension == ".pdf" and not content.startswith(b"%PDF-"):
        raise HTTPException(status_code=415, detail="File content does not match a PDF.")
    if extension == ".txt" and b"\x00" in content[:8192]:
        raise HTTPException(status_code=415, detail="Text file appears to contain binary data.")
