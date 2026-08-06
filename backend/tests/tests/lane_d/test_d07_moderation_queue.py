"""D-07 — Moderation admin queue API.

Lane-local: exercised as an admin (the completed require_admin is real; a D build
runs on the stub that admits everyone). The "403 for non-admins" cross-lane rule
is milestone m1. The verdict notifications go through Lane C and are asserted in
milestone m4.
"""


async def test_pending_queue_lists_held_content_oldest_first(auth_client, factory):
    author = await factory.user()
    q1 = await factory.question(author=author, moderation_status="pending",
                                title="First held question awaiting moderation here")
    q2 = await factory.question(author=author, moderation_status="pending",
                                title="Second held question awaiting moderation here")

    admin_c, _ = await auth_client(role="admin")
    r = await admin_c.get("/api/moderation/pending")
    assert r.status_code == 200
    ids = [item["id"] for item in r.json()]
    assert str(q1.id) in ids and str(q2.id) in ids
    # Oldest first.
    assert ids.index(str(q1.id)) < ids.index(str(q2.id))


async def test_approve_flips_status(auth_client, factory, db):
    author = await factory.user()
    q = await factory.question(author=author, moderation_status="pending")
    qid = q.id
    admin_c, _ = await auth_client(role="admin")
    r = await admin_c.put(f"/api/moderation/question/{qid}/approve")
    assert r.status_code == 200
    assert r.json()["moderation_status"] == "approved"

    from app.models.question import Question
    db.expire_all()
    fresh = (await db.execute(
        __import__("sqlalchemy").select(Question).where(Question.id == qid)
    )).scalar_one()
    assert fresh.moderation_status == "approved"


async def test_reject_requires_a_note(auth_client, factory):
    author = await factory.user()
    q = await factory.question(author=author, moderation_status="pending")
    admin_c, _ = await auth_client(role="admin")

    no_note = await admin_c.put(f"/api/moderation/question/{q.id}/reject", json={"note": "  "})
    assert no_note.status_code == 400

    ok = await admin_c.put(f"/api/moderation/question/{q.id}/reject", json={"note": "Off topic."})
    assert ok.status_code == 200
    assert ok.json()["moderation_status"] == "rejected"


async def test_cannot_reject_already_approved(auth_client, factory):
    author = await factory.user()
    q = await factory.question(author=author, moderation_status="approved")
    admin_c, _ = await auth_client(role="admin")
    r = await admin_c.put(f"/api/moderation/question/{q.id}/reject", json={"note": "late"})
    assert r.status_code == 409
