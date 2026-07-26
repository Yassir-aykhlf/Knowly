import json
import logging
from collections.abc import AsyncIterator
from dataclasses import dataclass

import httpx

from app.config import settings

logger = logging.getLogger("knowly.llm")

_OPENAI_CHAT_URL = "https://api.openai.com/v1/chat/completions"
_TIMEOUT = httpx.Timeout(120.0, connect=10.0)

@dataclass
class ChatMessage:
    role: str  # "system" | "user" | "assistant"
    content: str


class LLMError(Exception):
    """Base class for upstream LLM failures."""


class LLMTimeout(LLMError):
    pass


class LLMRateLimited(LLMError):
    pass


class LLMUnavailable(LLMError):
    pass


async def _stream_openai(messages: list[ChatMessage]) -> AsyncIterator[str]:
    payload = {
        "model": settings.LLM_MODEL,
        "messages": [{"role": m.role, "content": m.content} for m in messages],
        "stream": True,
    }
    headers = {"Authorization": f"Bearer {settings.LLM_API_KEY}"}
    try:
        async with httpx.AsyncClient(timeout=_TIMEOUT) as client:
            async with client.stream(
                "POST", _OPENAI_CHAT_URL, json=payload, headers=headers
            ) as resp:
                if resp.status_code == 429:
                    raise LLMRateLimited("The AI provider is rate limiting requests")
                if resp.status_code >= 400:
                    logger.warning("LLM provider returned HTTP %s", resp.status_code)
                    raise LLMUnavailable("The AI provider rejected the request")
                async for line in resp.aiter_lines():
                    if not line.startswith("data:"):
                        continue
                    data = line[len("data:"):].strip()
                    if data == "[DONE]":
                        return
                    try:
                        chunk = json.loads(data)
                    except ValueError:
                        continue
                    choices = chunk.get("choices") or [{}]
                    delta = choices[0].get("delta", {}).get("content")
                    if delta:
                        yield delta
    except httpx.TimeoutException as exc:
        raise LLMTimeout("The AI provider timed out") from exc
    except httpx.HTTPError as exc:
        raise LLMUnavailable("The AI provider is unreachable") from exc


_PROVIDERS = {"openai": _stream_openai}

def chat_stream(messages: list[ChatMessage]) -> AsyncIterator[str]:
    provider = _PROVIDERS.get(settings.LLM_PROVIDER)
    if provider is None:
        raise LLMUnavailable(f"Unknown LLM provider '{settings.LLM_PROVIDER}'")
    if not settings.LLM_API_KEY:
        raise LLMUnavailable("LLM_API_KEY is not configured")
    return provider(messages)