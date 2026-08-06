"""B-08 — Accept answer."""


async def test_accept_approved_answer(auth_client, factory):
    author = await factory.user(username="qowner")
    q = await factory.question(author=author)
    a = await factory.answer(question=q, author=await factory.user())

    owner_c, _ = await auth_client(user=author)
    r = await owner_c.post(f"/api/questions/{q.id}/accept-answer", json={"answer_id": str(a.id)})
    assert r.status_code == 200
    assert r.json()["accepted_answer_id"] == str(a.id)

    # Clearing acceptance.
    cleared = await owner_c.post(f"/api/questions/{q.id}/accept-answer", json={"answer_id": None})
    assert cleared.json()["accepted_answer_id"] is None


async def test_only_owner_can_accept(auth_client, factory):
    author = await factory.user()
    q = await factory.question(author=author)
    a = await factory.answer(question=q, author=author)
    other_c, _ = await auth_client(username="notowner")
    r = await other_c.post(f"/api/questions/{q.id}/accept-answer", json={"answer_id": str(a.id)})
    assert r.status_code == 403


async def test_cannot_accept_held_answer(auth_client, factory):
    author = await factory.user()
    q = await factory.question(author=author)
    held = await factory.answer(question=q, author=await factory.user(), moderation_status="pending")
    owner_c, _ = await auth_client(user=author)
    r = await owner_c.post(f"/api/questions/{q.id}/accept-answer", json={"answer_id": str(held.id)})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "invalid_answer"


async def test_cannot_accept_answer_from_another_question(auth_client, factory):
    author = await factory.user()
    q = await factory.question(author=author)
    other_q = await factory.question(author=author)
    foreign = await factory.answer(question=other_q, author=author)
    owner_c, _ = await auth_client(user=author)
    r = await owner_c.post(f"/api/questions/{q.id}/accept-answer", json={"answer_id": str(foreign.id)})
    assert r.status_code == 400
