"""C-09 — Direct messages API (open messaging, no notifications)."""
import uuid


async def test_send_message_open_to_anyone(auth_client, factory):
    recipient = await factory.user(username="recv")
    c, _ = await auth_client(username="sender")
    r = await c.post(f"/api/messages/{recipient.id}", json={"body": "hello there friend"})
    assert r.status_code == 201
    assert r.json()["body"] == "hello there friend"
    assert r.json()["read_at"] is None


async def test_cannot_message_yourself(alice):
    r = await alice.client.post(f"/api/messages/{alice.user.id}", json={"body": "hi me"})
    assert r.status_code == 400


async def test_message_unknown_user_is_404(alice):
    r = await alice.client.post(f"/api/messages/{uuid.uuid4()}", json={"body": "anyone?"})
    assert r.status_code == 404


async def test_conversation_list_reports_unread(auth_client, factory):
    me = await factory.user(username="reader")
    other = await factory.user(username="writer")
    await factory.message(sender=other, receiver=me, body="unread one", read=False)
    await factory.message(sender=other, receiver=me, body="unread two", read=False)

    c, _ = await auth_client(user=me)
    r = await c.get("/api/messages/conversations")
    assert r.status_code == 200
    convo = r.json()[0]
    assert convo["user"]["username"] == "writer"
    assert convo["unread_count"] == 2
    assert convo["last_message"] == "unread two"


async def test_mark_read_clears_unread(auth_client, factory):
    me = await factory.user(username="marker")
    other = await factory.user(username="othersender")
    await factory.message(sender=other, receiver=me, read=False)
    c, _ = await auth_client(user=me)
    assert (await c.put(f"/api/messages/{other.id}/read")).status_code == 204
    convo = (await c.get("/api/messages/conversations")).json()[0]
    assert convo["unread_count"] == 0
