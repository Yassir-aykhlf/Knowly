from dataclasses import dataclass

from app.config import settings


@dataclass
class ChatMessage:
    role: str
    content: str


class LLMError(Exception):
    """Base class for upstream LLM failures."""


class LLMTimeout(LLMError):
    pass


class LLMRateLimited(LLMError):
    pass


class LLMUnavailable(LLMError):
    pass


def chat_stream(messages: list[ChatMessage]):
    raise NotImplementedError("chat_stream is a stub; implement in task D-01")