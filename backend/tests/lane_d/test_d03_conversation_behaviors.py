import uuid
from datetime import datetime, timedelta

import pytest
from sqlalchemy import select

from app.models.ai import AiConversation, AiMessage


async def test_anonymous_access_requires_auth(client):
    url = f"/api/ai/conversations/{uuid.uuid4()}"
    assert (await client.post("/api/ai/conversations", json={})).status_code == 401
    assert (await client.get("/api/ai/conversations")).status_code == 401
    assert (await client.get(url)).status_code == 401
    assert (await client.delete(url)).status_code == 401


async def test_owner_only_listing_sorted_by_updated_at(alice, factory, db):
    old = await factory.ai_conversation(user=alice.user)
    newer = await factory.ai_conversation(user=alice.user)
    foreign = await factory.ai_conversation(user=await factory.user())
    old_id, newer_id, foreign_id = str(old.id), str(newer.id), str(foreign.id)
    old.updated_at = datetime.utcnow() - timedelta(days=1)
    await db.commit()
    response = await alice.client.get("/api/ai/conversations")
    assert [c["id"] for c in response.json()] == [newer_id, old_id]
    assert foreign_id not in [c["id"] for c in response.json()]
    old.updated_at = datetime.utcnow() + timedelta(seconds=1)
    await db.commit()
    response = await alice.client.get("/api/ai/conversations")
    assert [c["id"] for c in response.json()] == [old_id, newer_id]


async def test_title_capped_and_context_nested(alice, factory):
    question = await factory.question(author=alice.user, title="A" * 200)
    response = await alice.client.post("/api/ai/conversations", json={"question_id": str(question.id)})
    assert response.status_code == 201
    assert response.json()["title"] == ("Help with: " + question.title)[:80]
    assert response.json()["question"] == {"id": str(question.id), "title": question.title}
    assert set(response.json()) == {"id", "title", "question", "created_at", "updated_at"}


@pytest.mark.parametrize("status", ["pending", "rejected"])
async def test_unviewable_question_is_404_but_author_can_link(alice, auth_client, factory, status):
    question = await factory.question(author=alice.user, moderation_status=status)
    stranger, _ = await auth_client()
    payload = {"question_id": str(question.id)}
    assert (await stranger.post("/api/ai/conversations", json=payload)).status_code == 404
    assert (await stranger.get("/api/ai/conversations")).json() == []
    assert (await alice.client.post("/api/ai/conversations", json=payload)).status_code == 201


async def test_missing_question_does_not_create_conversation(alice):
    response = await alice.client.post("/api/ai/conversations", json={"question_id": str(uuid.uuid4())})
    assert response.status_code == 404
    assert (await alice.client.get("/api/ai/conversations")).json() == []


async def test_admin_cannot_read_or_delete_foreign_conversation(auth_client, factory):
    owner = await factory.user()
    conversation = await factory.ai_conversation(user=owner)
    await factory.ai_message(conversation=conversation, role="user", content="Private text")
    admin, _ = await auth_client(role="admin")
    url = f"/api/ai/conversations/{conversation.id}"
    assert (await admin.get(url)).status_code == 404
    assert (await admin.delete(url)).status_code == 404
    assert (await admin.get("/api/ai/conversations")).json() == []


async def test_messages_chronological_and_delete_cascades(alice, factory, db):
    conversation = await factory.ai_conversation(user=alice.user)
    first = await factory.ai_message(conversation=conversation, role="user", content="first")
    second = await factory.ai_message(conversation=conversation, role="assistant", content="second")
    first.created_at = datetime.utcnow() - timedelta(days=1)
    second.created_at = datetime.utcnow() - timedelta(days=2)
    await db.commit()
    id = conversation.id
    response = await alice.client.get(f"/api/ai/conversations/{id}")
    assert [message["content"] for message in response.json()["messages"]] == ["second", "first"]
    assert set(response.json()["messages"][0]) == {"id", "role", "content", "created_at"}
    response = await alice.client.delete(f"/api/ai/conversations/{id}")
    assert response.status_code == 204 and response.content == b""
    db.expire_all()
    assert await db.scalar(select(AiConversation).where(AiConversation.id == id)) is None
    assert not (await db.scalars(select(AiMessage).where(AiMessage.conversation_id == id))).all()


async def test_missing_conversation_is_404(alice):
    url = f"/api/ai/conversations/{uuid.uuid4()}"
    assert (await alice.client.get(url)).status_code == 404
    assert (await alice.client.delete(url)).status_code == 404


async def test_context_is_hidden_if_question_becomes_unviewable(alice, factory, db):
    question = await factory.question(author=await factory.user())
    created = await alice.client.post("/api/ai/conversations", json={"question_id": str(question.id)})
    id = created.json()["id"]
    question.moderation_status = "pending"
    await db.commit()
    assert (await alice.client.get(f"/api/ai/conversations/{id}")).json()["question"] is None
    assert (await alice.client.get("/api/ai/conversations")).json()[0]["question"] is None
