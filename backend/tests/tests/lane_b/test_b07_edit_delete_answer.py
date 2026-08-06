"""B-07 — Edit & delete answer."""
from sqlalchemy import func, select

from app.models.answer import Answer


async def test_edit_answer_author_only(auth_client, factory):
    author = await factory.user(username="ans_author")
    q = await factory.question(author=await factory.user())
    a = await factory.answer(question=q, author=author)

    intruder_c, _ = await auth_client(username="intruder2")
    forbidden = await intruder_c.put(f"/api/answers/{a.id}", json={"body": "hijack attempt that is long enough to pass"})
    assert forbidden.status_code == 403

    author_c, _ = await auth_client(user=author)
    ok = await author_c.put(f"/api/answers/{a.id}", json={"body": "An edited answer body that remains valid in length."})
    assert ok.status_code == 200
    assert "edited answer" in ok.json()["body"]


async def test_delete_answer_removes_it(auth_client, factory, db):
    author = await factory.user(username="ans_deleter")
    q = await factory.question(author=await factory.user())
    a = await factory.answer(question=q, author=author)

    author_c, _ = await auth_client(user=author)
    r = await author_c.delete(f"/api/answers/{a.id}")
    assert r.status_code == 204

    db.expire_all()
    assert (await db.execute(select(func.count()).select_from(Answer))).scalar_one() == 0


async def test_deleting_accepted_answer_clears_pointer(auth_client, factory, db):
    author = await factory.user(username="acc_author")
    q = await factory.question(author=author)
    a = await factory.answer(question=q, author=author)
    q.accepted_answer_id = a.id
    await factory.db.commit()
    qid = q.id  # capture before expire_all() so no lazy reload is triggered

    author_c, _ = await auth_client(user=author)
    assert (await author_c.delete(f"/api/answers/{a.id}")).status_code == 204

    from app.models.question import Question
    db.expire_all()
    fresh = (await db.execute(select(Question).where(Question.id == qid))).scalar_one()
    assert fresh.accepted_answer_id is None
