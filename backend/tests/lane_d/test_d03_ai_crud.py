"""D-03 — AI conversation CRUD (owner-scoped)."""
import uuid


async def test_create_list_get_delete(alice):
    created = await alice.client.post("/api/ai/conversations", json={})
    assert created.status_code == 201
    conv_id = created.json()["id"]

    listing = await alice.client.get("/api/ai/conversations")
    assert listing.status_code == 200
    assert any(c["id"] == conv_id for c in listing.json())

    got = await alice.client.get(f"/api/ai/conversations/{conv_id}")
    assert got.status_code == 200
    assert got.json()["messages"] == []

    deleted = await alice.client.delete(f"/api/ai/conversations/{conv_id}")
    assert deleted.status_code == 204
    assert (await alice.client.get(f"/api/ai/conversations/{conv_id}")).status_code == 404


async def test_another_users_conversation_is_404(auth_client, factory):
    owner = await factory.user()
    conv = await factory.ai_conversation(user=owner)
    intruder_c, _ = await auth_client(username="ai_intruder")
    # 404 (not 403) — existence is not leaked.
    assert (await intruder_c.get(f"/api/ai/conversations/{conv.id}")).status_code == 404
    assert (await intruder_c.delete(f"/api/ai/conversations/{conv.id}")).status_code == 404


async def test_create_with_question_context_seeds_title(alice, factory):
    q = await factory.question(author=alice.user, title="How do I debug an async deadlock here?")
    r = await alice.client.post("/api/ai/conversations", json={"question_id": str(q.id)})
    assert r.status_code == 201
    assert r.json()["question"]["id"] == str(q.id)
    assert r.json()["title"].startswith("Help with:")
