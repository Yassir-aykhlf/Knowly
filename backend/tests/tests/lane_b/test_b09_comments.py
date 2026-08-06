"""B-09 — Comments (polymorphic parent)."""
import uuid


async def test_comment_on_question_and_answer(auth_client, factory):
    author = await factory.user()
    q = await factory.question(author=author)
    a = await factory.answer(question=q, author=author)
    c, _ = await auth_client(username="commenter")

    on_q = await c.post("/api/comments", json={"parent_type": "question", "parent_id": str(q.id), "body": "Great question!"})
    assert on_q.status_code == 201
    assert on_q.json()["parent_type"] == "question"

    on_a = await c.post("/api/comments", json={"parent_type": "answer", "parent_id": str(a.id), "body": "Great answer!"})
    assert on_a.status_code == 201
    assert on_a.json()["parent_type"] == "answer"


async def test_comment_on_missing_parent_is_404(alice):
    r = await alice.client.post("/api/comments", json={"parent_type": "question", "parent_id": str(uuid.uuid4()), "body": "hi"})
    assert r.status_code == 404


async def test_empty_comment_is_rejected(auth_client, factory):
    q = await factory.question(author=await factory.user())
    c, _ = await auth_client()
    r = await c.post("/api/comments", json={"parent_type": "question", "parent_id": str(q.id), "body": ""})
    assert r.status_code == 400


async def test_edit_and_delete_own_comment(auth_client, factory):
    q = await factory.question(author=await factory.user())
    commenter = await factory.user(username="cmt_owner")
    comment = await factory.comment(author=commenter, parent_type="question", parent_id=q.id)

    c, _ = await auth_client(user=commenter)
    edited = await c.put(f"/api/comments/{comment.id}", json={"body": "edited comment body"})
    assert edited.status_code == 200
    assert edited.json()["body"] == "edited comment body"

    assert (await c.delete(f"/api/comments/{comment.id}")).status_code == 204
