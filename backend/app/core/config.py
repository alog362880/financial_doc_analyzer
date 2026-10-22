"""Application settings loaded from environment variables or a local .env file."""

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

LLMProviderName = Literal["anthropic", "gemini"]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Financial Document & Policy Analyzer"
    environment: str = "development"
    cors_origins: list[str] = Field(default_factory=lambda: ["http://localhost:5173"])

    database_url: str = "sqlite+aiosqlite:///./data/app.db"

    upload_dir: Path = Path("./data/uploads")
    max_upload_mb: int = Field(default=25, ge=1, le=200)
    max_document_chars: int = Field(default=120_000, ge=5_000)

    # LLM orchestration: one primary provider, optional fallback used only after the primary fails.
    llm_provider: LLMProviderName = "anthropic"
    llm_fallback_provider: LLMProviderName | None = None
    llm_temperature: float = Field(default=0.0, ge=0.0, le=1.0)
    llm_max_output_tokens: int = Field(default=4096, ge=512, le=32_000)
    llm_max_retries: int = Field(default=3, ge=1, le=10)
    llm_timeout_seconds: float = Field(default=120.0, gt=0)

    anthropic_api_key: str | None = None
    anthropic_model: str = "claude-sonnet-5-5"

    gemini_api_key: str | None = None
    gemini_model: str = "gemini-2.5-flash"

    @property
    def max_upload_bytes(self) -> int:
        return self.max_upload_mb * 1024 * 1024


@lru_cache
def get_settings() -> Settings:
    return Settings()
