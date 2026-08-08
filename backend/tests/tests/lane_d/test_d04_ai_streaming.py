"""D-04 — AI streaming endpoint (SSE).

The LLM provider is replaced by the ``fake_llm`` fixture so the suite is
hermetic (no network).
"""
from sqlalchemy import select

from app.models.ai import AiMessage
from app.services import llm


async def test_stream_emits_tokens_and_persists_turns(alice, factory, fake_llm, db):
    fake_llm.tokens = ["Hel", "lo ", "there"]
    conv = await factory.ai_conversation(user=alice.user)
    conv_id = conv.id  # capture before expire_all()

    r = await alice.client.post(
        f"/api/ai/conversations/{conv_id}/messages", json={"content": "hi assistant"}
    )
    assert r.status_code == 200
    body = r.text
    # Tokens arrive as SSE data events, terminated by event: done.
    assert '"delta": "Hel"' in body
    assert "event: done" in body

    # The user turn (and the assembled assistant turn) are persisted.
    db.expire_all()
    msgs = (
        await db.execute(
            select(AiMessage).where(AiMessage.conversation_id == conv_id)
            .order_by(AiMessage.created_at.asc())
        )
    ).scalars().all()
    roles = [m.role for m in msgs]
    assert "user" in roles and "assistant" in roles
    user_msg = next(m for m in msgs if m.role == "user")
    assert user_msg.content == "hi assistant"


async def test_rate_limit_returns_429_with_retry_after(alice, factory, fake_llm, monkeypatch):
    monkeypatch.setattr("app.routers.ai.settings.LLM_RATE_LIMIT_PER_HOUR", 1)
    conv = await factory.ai_conversation(user=alice.user)

    first = await alice.client.post(f"/api/ai/conversations/{conv.id}/messages", json={"content": "one"})
    assert first.status_code == 200

    second = await alice.client.post(f"/api/ai/conversations/{conv.id}/messages", json={"content": "two"})
    assert second.status_code == 429
    assert second.json()["error"]["code"] == "rate_limited"
    assert "Retry-After" in second.headers


async def test_llm_failure_becomes_sse_error_event(alice, factory, fake_llm):
    fake_llm.raise_ = llm.LLMError("boom")
    conv = await factory.ai_conversation(user=alice.user)
    r = await alice.client.post(f"/api/ai/conversations/{conv.id}/messages", json={"content": "hi"})
    assert r.status_code == 200  # the stream opens, then reports the error inside it
    assert "event: error" in r.text
