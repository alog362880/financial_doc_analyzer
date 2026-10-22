"""Provider toggle, retry policy and fallback for LLM analysis.

- `LLM_PROVIDER` selects the primary provider.
- `LLM_FALLBACK_PROVIDER` (optional) is tried only after the primary exhausts its retries.
- A provider without an API key is treated as unavailable rather than crashing the server.
"""

import logging
from dataclasses import dataclass
from typing import Final

from tenacity import AsyncRetrying, retry_if_exception_type, stop_after_attempt, wait_exponential_jitter

from app.core.config import Settings, get_settings
from app.schemas.analysis import FinancialAnalysis
from app.services.anthropic_client import AnthropicAnalysisProvider
from app.services.gemini_client import GeminiAnalysisProvider
from app.services.llm_base import AnalysisProvider, LLMError, PermanentLLMError, TransientLLMError

logger = logging.getLogger(__name__)

_MAX_BACKOFF_SECONDS: Final = 20


@dataclass(frozen=True, slots=True)
class AnalysisOutcome:
    analysis: FinancialAnalysis
    provider: str
    model: str


def _build_provider(settings: Settings, name: str) -> AnalysisProvider | None:
    if name == "anthropic":
        if not settings.anthropic_api_key:
            return None
        return AnthropicAnalysisProvider(
            api_key=settings.anthropic_api_key,
            model=settings.anthropic_model,
            temperature=settings.llm_temperature,
            max_output_tokens=settings.llm_max_output_tokens,
            timeout=settings.llm_timeout_seconds,
        )
    if name == "gemini":
        if not settings.gemini_api_key:
            return None
        return GeminiAnalysisProvider(
            api_key=settings.gemini_api_key,
            model=settings.gemini_model,
            temperature=settings.llm_temperature,
            max_output_tokens=settings.llm_max_output_tokens,
        )
    return None


class LLMRouter:
    def __init__(self, primary: AnalysisProvider, fallback: AnalysisProvider | None, max_retries: int) -> None:
        self._primary = primary
        self._fallback = fallback
        self._max_retries = max_retries

    @classmethod
    def from_settings(cls, settings: Settings) -> "LLMRouter":
        primary = _build_provider(settings, settings.llm_provider)
        if primary is None:
            raise PermanentLLMError(f"LLM provider '{settings.llm_provider}' is not configured (missing API key)")

        fallback: AnalysisProvider | None = None
        if settings.llm_fallback_provider and settings.llm_fallback_provider != settings.llm_provider:
            fallback = _build_provider(settings, settings.llm_fallback_provider)
            if fallback is None:
                logger.warning("Fallback provider '%s' is not configured; fallback disabled", settings.llm_fallback_provider)

        return cls(primary=primary, fallback=fallback, max_retries=settings.llm_max_retries)

    async def analyze(self, system_prompt: str, user_prompt: str) -> AnalysisOutcome:
        try:
            analysis = await self._call_with_retries(self._primary, system_prompt, user_prompt)
            return AnalysisOutcome(analysis, self._primary.name, self._primary.model)
        except LLMError as primary_error:
            if self._fallback is None:
                raise
            logger.warning(
                "Primary LLM provider %s failed (%s); switching to fallback %s",
                self._primary.name,
                primary_error,
                self._fallback.name,
            )
            analysis = await self._call_with_retries(self._fallback, system_prompt, user_prompt)
            return AnalysisOutcome(analysis, self._fallback.name, self._fallback.model)

    async def _call_with_retries(
        self,
        provider: AnalysisProvider,
        system_prompt: str,
        user_prompt: str,
    ) -> FinancialAnalysis:
        retrying = AsyncRetrying(
            stop=stop_after_attempt(self._max_retries),
            wait=wait_exponential_jitter(initial=1, max=_MAX_BACKOFF_SECONDS),
            retry=retry_if_exception_type(TransientLLMError),
            reraise=True,
        )
        async for attempt in retrying:
            with attempt:
                analysis = await provider.analyze(system_prompt, user_prompt)
                return analysis
        raise PermanentLLMError("Retry loop exited without a result")  # pragma: no cover


_router: LLMRouter | None = None


def get_llm_router() -> LLMRouter:
    global _router
    if _router is None:
        _router = LLMRouter.from_settings(get_settings())
    return _router
