"""D-01 — LLM provider client (structured-error contract)."""
import pytest

from app.services import llm


def test_missing_key_raises_unavailable(monkeypatch):
    monkeypatch.setattr(llm.settings, "LLM_API_KEY", "")
    monkeypatch.setattr(llm.settings, "LLM_PROVIDER", "openai")
    with pytest.raises(llm.LLMUnavailable):
        llm.chat_stream([llm.ChatMessage("user", "hi")])


def test_unknown_provider_raises_unavailable(monkeypatch):
    monkeypatch.setattr(llm.settings, "LLM_API_KEY", "sk-test")
    monkeypatch.setattr(llm.settings, "LLM_PROVIDER", "nonexistent-provider")
    with pytest.raises(llm.LLMUnavailable):
        llm.chat_stream([llm.ChatMessage("user", "hi")])


def test_error_hierarchy_is_catchable_as_llmerror():
    for exc in (llm.LLMTimeout, llm.LLMRateLimited, llm.LLMUnavailable):
        assert issubclass(exc, llm.LLMError)
