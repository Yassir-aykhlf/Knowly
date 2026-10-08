import json
from collections.abc import AsyncIterator, Callable
from dataclasses import asdict, dataclass
from typing import Literal

import httpx

from app.config import settings


@dataclass
class ChatMessage:
    role: Literal["system", "user", "assistant"]
    content: str


class LLMError(Exception):
    pass


class LLMTimeout(LLMError):
    pass


class LLMRateLimited(LLMError):
    pass


class LLMUnavailable(LLMError):
    pass


CHAT_COMPLETIONS_URL = "https://api.openai.com/v1/chat/completions"
STREAM_TIMEOUT = httpx.Timeout(300.0, connect=10.0, write=30.0, pool=10.0)


async def _sse_payloads(response: httpx.Response) -> AsyncIterator[str]:
    data = []
    async for line in response.aiter_lines():
        if not line:
            if data:
                yield "\n".join(data)
                data = []
        elif line.startswith("data:"):
            data.append(line[5:].removeprefix(" "))
    if data:
        yield "\n".join(data)


async def _request_stream(api_key: str, payload: dict) -> AsyncIterator[str]:
    try:
        async with httpx.AsyncClient(timeout=STREAM_TIMEOUT) as client:
            async with client.stream(
                "POST", CHAT_COMPLETIONS_URL,
                headers={"Authorization": f"Bearer {api_key}"}, json=payload,
            ) as response:
                if response.status_code == 429:
                    raise LLMRateLimited("LLM provider rate limited")
                if response.status_code >= 400:
                    raise LLMUnavailable("LLM provider unavailable")
                async for data in _sse_payloads(response):
                    if data.strip() == "[DONE]":
                        return
                    event = json.loads(data)
                    if "error" in event:
                        raise LLMUnavailable("LLM provider unavailable")
                    choices = event["choices"]
                    if not choices:
                        continue
                    delta = choices[0]["delta"].get("content")
                    if delta is not None and not isinstance(delta, str):
                        raise LLMUnavailable("LLM provider returned an invalid stream")
                    if delta:
                        yield delta
                raise LLMUnavailable("LLM provider stream ended unexpectedly")
    except LLMError:
        raise
    except httpx.TimeoutException:
        raise LLMTimeout("LLM provider timed out") from None
    except Exception:
        raise LLMUnavailable("LLM provider unavailable") from None


def _openai_stream(messages: list[ChatMessage]) -> AsyncIterator[str]:
    return _request_stream(settings.LLM_API_KEY, {
        "model": settings.LLM_MODEL,
        "stream": True,
        "messages": [asdict(message) for message in messages],
    })


PROVIDERS: dict[str, Callable[[list[ChatMessage]], AsyncIterator[str]]] = {
    "openai": _openai_stream,
}


def chat_stream(messages: list[ChatMessage]) -> AsyncIterator[str]:
    if not settings.LLM_API_KEY.strip():
        raise LLMUnavailable("LLM provider is not configured")
    provider = PROVIDERS.get(settings.LLM_PROVIDER)
    if provider is None:
        raise LLMUnavailable("LLM provider is not configured")
    return provider(messages)
