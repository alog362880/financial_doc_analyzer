"""Shared contract and error taxonomy for LLM analysis providers."""

from abc import ABC, abstractmethod

from app.schemas.analysis import FinancialAnalysis


class LLMError(Exception):
    """Base class for failures while obtaining an analysis from a provider."""


class TransientLLMError(LLMError):
    """Retryable failure: rate limits, timeouts, 5xx responses, or malformed model output."""


class PermanentLLMError(LLMError):
    """Non-retryable failure: bad credentials, rejected requests, or misconfiguration."""


class AnalysisProvider(ABC):
    name: str = "base"

    def __init__(self, *, model: str, temperature: float, max_output_tokens: int) -> None:
        self.model = model
        self.temperature = temperature
        self.max_output_tokens = max_output_tokens

    @abstractmethod
    async def analyze(self, system_prompt: str, user_prompt: str) -> FinancialAnalysis:
        """Return a validated FinancialAnalysis or raise an LLMError subclass."""
