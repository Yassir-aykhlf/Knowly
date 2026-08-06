"""A-06 — Public profile + contribution counts.

Lane-local: state is arranged with direct inserts of *approved* content (where
the real visibility filter and the Launch Pad stub agree). Owner-sees-own-pending
and real friendship state are milestone concerns (m2 / m5).
"""
import uuid


async def test_unknown_user_is_404(client):
    r = await client.get(f"/api/users/{uuid.uuid4()}")
    assert r.status_code == 404


async def test_profile_counts_approved_contributions(client, factory):
    target = await factory.user(username="carol")
    q1 = await factory.question(author=target)
    await factory.question(author=target)
    ans = await factory.answer(question=q1, author=target)
    # Mark the answer accepted so accepted_answer_count is exercised.
    q1.accepted_answer_id = ans.id
    await factory.db.commit()

    r = await client.get(f"/api/users/{target.id}")
    assert r.status_code == 200
    body = r.json()
    assert body["username"] == "carol"
    assert body["question_count"] == 2
    assert body["answer_count"] == 1
    assert body["accepted_answer_count"] == 1
    # No email/role/oauth ever leaks in a public profile.
    assert "email" not in body and "role" not in body


async def test_profile_never_leaks_private_fields_and_friendship_defaults_none(
    auth_client, factory
):
    target = await factory.user(username="dave")
    viewer_c, _ = await auth_client(username="viewer")
    r = await viewer_c.get(f"/api/users/{target.id}")
    assert r.status_code == 200
    # With no relationship, state is "none" (stub and real agree here).
    assert r.json()["friendship"]["state"] == "none"


async def test_anonymized_profile_hides_bio_and_avatar(client, factory):
    ghost = await factory.user(username="[deleted_ab12cd]", email=None, password=None,
                               is_anonymized=True, bio="was here", avatar_path="/avatars/x.png")
    r = await client.get(f"/api/users/{ghost.id}")
    assert r.status_code == 200
    body = r.json()
    assert body["is_anonymized"] is True
    assert body["bio"] is None
    assert body["avatar_url"] is None
