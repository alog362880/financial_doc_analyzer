"""Anthropic Claude provider. Structured output is forced through a tool whose input schema is FinancialAnalysis."""

import anthropic
from anthropic import AsyncAnthropic
from pydantic import ValidationError

from app.schemas.analysis import FinancialAnalysis
from app.services.llm_base import AnalysisProvider, PermanentLLMError, TransientLLMError

TOOL_NAME = "record_financial_analysis"


class AnthropicAnalysisProvider(AnalysisProvider):
    name = "anthropic"

    def __init__(
        self,
        *,
        api_key: str,
        model: str,
        temperature: float,
        max_output_tokens: int,
        timeout: float,
    ) -> None:
        super().__init__(model=model, temperature=temperature, max_output_tokens=max_output_tokens)
        # SDK-level retries are disabled; retry policy lives in LLMRouter so it is uniform across providers.
        self._client = AsyncAnthropic(api_key=api_key, timeout=timeout, max_retries=0)

    async def analyze(self, system_prompt: str, user_prompt: str) -> FinancialAnalysis:
        tool = {
            "name": TOOL_NAME,
            "description": "Record the structured financial risk analysis of the document.",
            "input_schema": FinancialAnalysis.model_json_schema(),
        }
        try:
            response = await self._client.messages.create(
                model=self.model,
                max_tokens=self.max_output_tokens,
                temperature=self.temperature,
                system=system_prompt,
                messages=[{"role": "user", "content": user_prompt}],
                tools=[tool],
                tool_choice={"type": "tool", "name": TOOL_NAME},
            )
        except (anthropic.RateLimitError, anthropic.InternalServerError, anthropic.APIConnectionError) as exc:
            raise TransientLLMError(f"Anthropic temporarily unavailable ({type(exc).__name__})") from exc
        except anthropic.APIStatusError as exc:
            raise PermanentLLMError(f"Anthropic rejected the request (HTTP {exc.status_code})") from exc

        for block in response.content:
            if block.type == "tool_use" and block.name == TOOL_NAME:
                try:
                    return FinancialAnalysis.model_validate(block.input)
                except ValidationError as exc:
                    raise TransientLLMError("Anthropic output failed schema validation") from exc

        raise TransientLLMError("Anthropic returned no structured analysis")
