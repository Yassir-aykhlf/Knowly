"""B-06 — Create answer."""
import uuid

BODY = "You should use dependency injection here and keep the router thin overall."


async def test_answer_someone_elses_question(auth_client, factory):
    qauthor = await factory.user()
    q = await factory.question(author=qauthor)
    responder_c, _ = await auth_client(username="responder")
    r = await responder_c.post(f"/api/questions/{q.id}/answers", json={"body": BODY})
    assert r.status_code == 201
    assert r.json()["body"] == BODY
    assert r.json()["is_ai_assisted"] is False


async def test_self_answer_is_allowed(auth_client, factory):
    author = await factory.user(username="selfanswer")
    q = await factory.question(author=author)
    author_c, _ = await auth_client(user=author)
    r = await author_c.post(f"/api/questions/{q.id}/answers", json={"body": BODY})
    assert r.status_code == 201


async def test_answer_on_missing_question_is_404(alice):
    r = await alice.client.post(f"/api/questions/{uuid.uuid4()}/answers", json={"body": BODY})
    assert r.status_code == 404


async def test_short_answer_is_rejected(auth_client, factory):
    q = await factory.question(author=await factory.user())
    c, _ = await auth_client()
    r = await c.post(f"/api/questions/{q.id}/answers", json={"body": "too short"})
    assert r.status_code == 400
    assert "body" in r.json()["error"]["fields"]
