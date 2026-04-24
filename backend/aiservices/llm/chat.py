"""
Google Gemini LLM chat wrapper with automatic model fallback
Uses Google Gemini API under the hood.
Tries gemini-2.0-flash first, falls back to gemini-1.5-flash on quota errors.
"""

from dataclasses import dataclass
from google import genai
from google.genai import types


@dataclass
class UserMessage:
    text: str


MODELS_TO_TRY = [
    "gemini-2.0-flash",
    "gemini-2.0-flash-lite",
    "gemini-2.5-flash",
    "gemini-flash-latest",
]


class LlmChat:
    def __init__(self, api_key: str, session_id: str = "", system_message: str = ""):
        self._api_key = api_key
        self._session_id = session_id
        self._system_message = system_message

    def with_model(self, provider: str, model: str) -> "LlmChat":
        return self

    async def send_message(self, message: UserMessage) -> str:
        client = genai.Client(api_key=self._api_key)
        config = types.GenerateContentConfig(
            system_instruction=self._system_message if self._system_message else None,
        )

        last_error = None
        for model in MODELS_TO_TRY:
            try:
                response = await client.aio.models.generate_content(
                    model=model,
                    contents=message.text,
                    config=config,
                )
                return response.text or ""
            except Exception as e:
                err_str = str(e)
                if "429" in err_str or "RESOURCE_EXHAUSTED" in err_str or "quota" in err_str.lower():
                    last_error = e
                    continue  # try next model
                raise

        raise RuntimeError(
            f"All Gemini models quota-exhausted. Last error: {last_error}"
        )
