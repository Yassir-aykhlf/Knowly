"""C-02 — Notification inbox API."""
import uuid


async def test_list_unread_count_and_mark_read(auth_client, factory):
    owner = await factory.user(username="inboxowner")
    actor = await factory.user()
    n1 = await factory.notification(recipient=owner, actor=actor, event_type="answer_created")
    await factory.notification(recipient=owner, actor=actor, event_type="friend_request")

    c, _ = await auth_client(user=owner)

    listing = await c.get("/api/notifications?page=1&limit=20")
    assert listing.status_code == 200
    assert listing.json()["total"] == 2

    assert (await c.get("/api/notifications/unread-count")).json()["count"] == 2

    assert (await c.put(f"/api/notifications/{n1.id}/read")).status_code == 204
    assert (await c.get("/api/notifications/unread-count")).json()["count"] == 1

    assert (await c.put("/api/notifications/read-all")).status_code == 204
    assert (await c.get("/api/notifications/unread-count")).json()["count"] == 0


async def test_cannot_read_someone_elses_notification(auth_client, factory):
    other = await factory.user()
    theirs = await factory.notification(recipient=other, event_type="friend_request")
    c, _ = await auth_client(username="nosy")
    # 404, not 403 — existence is not leaked.
    assert (await c.put(f"/api/notifications/{theirs.id}/read")).status_code == 404
    assert (await c.put(f"/api/notifications/{uuid.uuid4()}/read")).status_code == 404
