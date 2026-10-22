"""Google Gemini provider. Structured output uses JSON response MIME type with FinancialAnalysis as response_schema."""

from google import genai
from google.genai import errors as genai_errors
from google.genai import types
from pydantic import ValidationError

from app.schemas.analysis import FinancialAnalysis
from app.services.llm_base import AnalysisProvider, PermanentLLMError, TransientLLMError

_TRANSIENT_STATUS_CODES = frozenset({408, 429})


class GeminiAnalysisProvider(AnalysisProvider):
    name = "gemini"

    def __init__(self, *, api_key: str, model: str, temperature: float, max_output_tokens: int) -> None:
        super().__init__(model=model, temperature=temperature, max_output_tokens=max_output_tokens)
        self._client = genai.Client(api_key=api_key)

    async def analyze(self, system_prompt: str, user_prompt: str) -> FinancialAnalysis:
        try:
            response = await self._client.aio.models.generate_content(
                model=self.model,
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=self.temperature,
                    max_output_tokens=self.max_output_tokens,
                    response_mime_type="application/json",
                    response_schema=FinancialAnalysis,
                ),
            )
        except genai_errors.APIError as exc:
            code = exc.code or 0
            if code in _TRANSIENT_STATUS_CODES or code >= 500:
                raise TransientLLMError(f"Gemini temporarily unavailable (HTTP {code})") from exc
            raise PermanentLLMError(f"Gemini rejected the request (HTTP {code})") from exc
        except (TimeoutError, ConnectionError) as exc:
            raise TransientLLMError("Gemini connection failed") from exc

        raw = response.text
        if not raw:
            raise TransientLLMError("Gemini returned an empty response")
        try:
            return FinancialAnalysis.model_validate_json(raw)
        except ValidationError as exc:
            raise TransientLLMError("Gemini output failed schema validation") from exc
