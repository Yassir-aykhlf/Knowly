import asyncio
import uuid
from datetime import datetime, timedelta
from types import SimpleNamespace

import pytest
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker

from app.models.ai import AiConversation, AiMessage
from app.routers import ai
from app.services import llm


@pytest.mark.parametrize("content", ["", " \n\t ", "a" * 8001, None, 42])
async def test_invalid_content_rejected_without_persistence(alice, factory, db, content):
    conversation = await factory.ai_conversation(user=alice.user)
    response = await alice.client.post(f"/api/ai/conversations/{conversation.id}/messages", json={"content": content})
    assert response.status_code == 400
    assert "content" in response.json()["error"]["fields"]
    assert not (await db.scalars(select(AiMessage))).all()


async def test_headers_title_history_and_question_grounding(alice, factory, fake_llm, db):
    question = await factory.question(author=alice.user)
    conversation = await factory.ai_conversation(user=alice.user, question=question, title=None)
    await factory.ai_message(conversation=conversation, role="user", content="Earlier question")
    await factory.ai_message(conversation=conversation, role="assistant", content="Earlier answer")
    id = conversation.id
    text = "a" * 100 + "\nAnother line"
    response = await alice.client.post(f"/api/ai/conversations/{id}/messages", json={"content": f"  {text}  "})
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/event-stream")
    assert response.headers["cache-control"] == "no-cache"
    assert response.headers["x-accel-buffering"] == "no"
    assert [message.role for message in fake_llm.seen] == ["system", "user", "assistant", "user"]
    assert fake_llm.seen[-1].content == text
    assert question.title in fake_llm.seen[0].content
    assert question.body in fake_llm.seen[0].content
    db.expire_all()
    stored = await db.get(AiConversation, id)
    assert stored.title == "a" * 80
    assert response.text.endswith("event: done\ndata: {}\n\n")


async def test_trim_happens_before_length_validation(alice, factory, fake_llm):
    conversation = await factory.ai_conversation(user=alice.user)
    response = await alice.client.post(f"/api/ai/conversations/{conversation.id}/messages",
                                       json={"content": " " * 8000 + "hi"})
    assert response.status_code == 200
    assert fake_llm.seen[-1].content == "hi"


async def test_send_is_owner_scoped_even_for_admin(auth_client, factory):
    conversation = await factory.ai_conversation(user=await factory.user())
    admin, _ = await auth_client(role="admin")
    response = await admin.post(f"/api/ai/conversations/{conversation.id}/messages", json={"content": "Hi"})
    assert response.status_code == 404


async def test_anonymous_send_requires_auth(client):
    response = await client.post(f"/api/ai/conversations/{uuid.uuid4()}/messages", json={"content": "Hi"})
    assert response.status_code == 401


async def test_hourly_quota_across_conversations_and_retry_after(alice, factory, fake_llm, monkeypatch):
    monkeypatch.setattr(ai.settings, "LLM_RATE_LIMIT_PER_HOUR", 1)
    first = await factory.ai_conversation(user=alice.user)
    second = await factory.ai_conversation(user=alice.user)
    other = await factory.ai_conversation(user=await factory.user())
    await factory.ai_message(conversation=other, role="user", content="Does not count")
    assert (await alice.client.post(f"/api/ai/conversations/{first.id}/messages", json={"content": "one"})).status_code == 200
    response = await alice.client.post(f"/api/ai/conversations/{second.id}/messages", json={"content": "two"})
    assert response.status_code == 429
    assert 3590 <= int(response.headers["retry-after"]) <= 3600


async def test_old_user_turn_and_assistant_turns_do_not_count(alice, factory, fake_llm, monkeypatch, db):
    monkeypatch.setattr(ai.settings, "LLM_RATE_LIMIT_PER_HOUR", 1)
    conversation = await factory.ai_conversation(user=alice.user)
    old = await factory.ai_message(conversation=conversation, role="user", content="old")
    old.created_at = datetime.utcnow() - timedelta(hours=2)
    await db.commit()
    await factory.ai_message(conversation=conversation, role="assistant", content="recent answer")
    response = await alice.client.post(f"/api/ai/conversations/{conversation.id}/messages", json={"content": "new"})
    assert response.status_code == 200


@pytest.mark.parametrize("failure,label", [
    (llm.LLMRateLimited("secret-key"), "rate-limited"),
    (llm.LLMTimeout("secret-key"), "timed out"),
    (llm.LLMUnavailable("secret-key"), "unavailable"),
    (ValueError("secret-key"), "unavailable"),
])
async def test_error_events_are_sanitized_and_user_turn_survives(alice, factory, fake_llm, db, failure, label):
    fake_llm.raise_ = failure
    conversation = await factory.ai_conversation(user=alice.user)
    id = conversation.id
    response = await alice.client.post(f"/api/ai/conversations/{id}/messages", json={"content": "save me"})
    assert response.status_code == 200
    assert "event: error" in response.text and label in response.text
    assert "secret-key" not in response.text and "event: done" not in response.text
    messages = (await db.scalars(select(AiMessage).where(AiMessage.conversation_id == id))).all()
    assert [(m.role, m.content) for m in messages] == [("user", "save me")]


async def test_configuration_error_at_call_time_becomes_sse_error(alice, factory, monkeypatch):
    monkeypatch.setattr(llm.settings, "LLM_API_KEY", "")
    conversation = await factory.ai_conversation(user=alice.user)
    response = await alice.client.post(f"/api/ai/conversations/{conversation.id}/messages", json={"content": "Hi"})
    assert response.status_code == 200 and "event: error" in response.text


async def test_user_is_committed_before_first_token_and_error_keeps_partial(alice, factory, db, monkeypatch):
    conversation = await factory.ai_conversation(user=alice.user)
    id = conversation.id
    sessions = async_sessionmaker(db.bind, expire_on_commit=False)
    closed = []
    async def provider(messages):
        try:
            async with sessions() as session:
                persisted = await session.scalar(select(AiMessage).where(
                    AiMessage.conversation_id == id, AiMessage.role == "user",
                ))
                assert persisted.content == "Hi"
            yield "partial"
            raise llm.LLMTimeout("secret-key")
        finally:
            closed.append(True)
    monkeypatch.setattr(llm, "chat_stream", provider)
    response = await alice.client.post(f"/api/ai/conversations/{id}/messages", json={"content": "Hi"})
    assert '"delta": "partial"' in response.text and "event: error" in response.text
    assert closed == [True]
    stored = await db.scalar(select(AiMessage).where(AiMessage.conversation_id == id, AiMessage.role == "assistant"))
    assert stored.content == "partial"


async def test_disconnection_keeps_received_partial_reply(factory, db, monkeypatch):
    user = await factory.user()
    conversation = await factory.ai_conversation(user=user)
    id, uid = conversation.id, user.id
    closed = []
    async def provider(messages):
        try:
            yield "first"
            yield "second"
        finally:
            closed.append(True)
    calls = []
    async def disconnected():
        calls.append(True)
        return len(calls) == 2
    monkeypatch.setattr(llm, "chat_stream", provider)
    sessions = async_sessionmaker(db.bind, expire_on_commit=False)
    response = [event async for event in ai._stream_reply(
        SimpleNamespace(is_disconnected=disconnected), [], sessions, id, uid,
    )]
    assert len(response) == 1 and "first" in response[0]
    assert closed == [True]
    stored = await db.scalar(select(AiMessage).where(AiMessage.conversation_id == id))
    assert stored.content == "firstsecond"


async def test_task_cancellation_closes_upstream_and_shields_partial_write(factory, db, monkeypatch):
    user = await factory.user()
    conversation = await factory.ai_conversation(user=user)
    id, uid = conversation.id, user.id
    waiting = asyncio.Event()
    closed = []
    async def provider(messages):
        try:
            yield "partial"
            waiting.set()
            await asyncio.Event().wait()
        finally:
            closed.append(True)
    async def disconnected():
        return False
    monkeypatch.setattr(llm, "chat_stream", provider)
    sessions = async_sessionmaker(db.bind, expire_on_commit=False)
    stream = ai._stream_reply(SimpleNamespace(is_disconnected=disconnected), [], sessions, id, uid)
    assert "partial" in await anext(stream)
    task = asyncio.create_task(anext(stream))
    await asyncio.wait_for(waiting.wait(), timeout=1)
    task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await task
    assert closed == [True]
    stored = await db.scalar(select(AiMessage).where(AiMessage.conversation_id == id))
    assert stored.content == "partial"


async def test_concurrent_requests_cannot_exceed_user_quota(alice, factory, fake_llm, monkeypatch):
    monkeypatch.setattr(ai.settings, "LLM_RATE_LIMIT_PER_HOUR", 1)
    first = await factory.ai_conversation(user=alice.user)
    second = await factory.ai_conversation(user=alice.user)
    responses = await asyncio.gather(*(
        alice.client.post(f"/api/ai/conversations/{id}/messages", json={"content": "Hi"})
        for id in (first.id, second.id)
    ))
    assert sorted(response.status_code for response in responses) == [200, 429]
