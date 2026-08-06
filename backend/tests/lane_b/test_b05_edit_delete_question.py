"""B-05 — Edit & delete question (ownership + cascade)."""
from sqlalchemy import func, select

from app.models.answer import Answer
from app.models.comment import Comment
from app.models.vote import Vote


async def test_edit_updates_fields_author_only(auth_client, factory):
    author = await factory.user(username="owner")
    q = await factory.question(author=author)

    other_c, _ = await auth_client(username="intruder")
    forbidden = await other_c.put(f"/api/questions/{q.id}", json={
        "title": "Trying to hijack someone else's question here",
        "body": "This should be rejected because I am not the author of it.",
        "tags": [],
    })
    assert forbidden.status_code == 403

    owner_c, _ = await auth_client(user=author)
    ok = await owner_c.put(f"/api/questions/{q.id}", json={
        "title": "An edited but still perfectly valid title goes here",
        "body": "The body has also been updated to something new and valid now.",
        "tags": ["edited"],
    })
    assert ok.status_code == 200
    assert ok.json()["tags"] == ["edited"]


async def test_delete_cascades_answers_comments_votes(auth_client, factory, db):
    author = await factory.user(username="deleter")
    q = await factory.question(author=author)
    a = await factory.answer(question=q, author=author)
    await factory.comment(author=author, parent_type="question", parent_id=q.id)
    await factory.comment(author=author, parent_type="answer", parent_id=a.id)
    await factory.vote(voter=await factory.user(), target_type="question", target_id=q.id, value=1)
    await factory.vote(voter=await factory.user(), target_type="answer", target_id=a.id, value=1)

    owner_c, _ = await auth_client(user=author)
    r = await owner_c.delete(f"/api/questions/{q.id}")
    assert r.status_code == 204

    db.expire_all()
    assert (await db.execute(select(func.count()).select_from(Answer))).scalar_one() == 0
    assert (await db.execute(select(func.count()).select_from(Comment))).scalar_one() == 0
    assert (await db.execute(select(func.count()).select_from(Vote))).scalar_one() == 0
