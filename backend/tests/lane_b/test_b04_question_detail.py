"""B-04 — Question detail (assembled payload)."""
import uuid


async def test_detail_sorts_accepted_answer_first(client, factory):
    author = await factory.user()
    voter = await factory.user()
    q = await factory.question(author=author)
    a_popular = await factory.answer(question=q, author=await factory.user(), body="This popular answer has some upvotes on it.")
    a_accepted = await factory.answer(question=q, author=await factory.user(), body="This accepted answer has no votes at all here.")
    await factory.vote(voter=voter, target_type="answer", target_id=a_popular.id, value=1)
    q.accepted_answer_id = a_accepted.id
    await factory.db.commit()

    r = await client.get(f"/api/questions/{q.id}")
    assert r.status_code == 200
    answers = r.json()["answers"]
    # Accepted first regardless of votes, then by votes.
    assert answers[0]["id"] == str(a_accepted.id)
    assert answers[1]["id"] == str(a_popular.id)
    assert answers[1]["vote_total"] == 1


async def test_detail_increments_view_count(client, factory):
    q = await factory.question(author=await factory.user())
    first = (await client.get(f"/api/questions/{q.id}")).json()["view_count"]
    second = (await client.get(f"/api/questions/{q.id}")).json()["view_count"]
    assert second == first + 1


async def test_held_question_is_404_for_strangers_but_visible_to_author(auth_client, factory):
    author = await factory.user(username="qauthor")
    held = await factory.question(author=author, moderation_status="pending")

    stranger_c, _ = await auth_client(username="stranger")
    assert (await stranger_c.get(f"/api/questions/{held.id}")).status_code == 404

    author_c, _ = await auth_client(user=author)
    r = await author_c.get(f"/api/questions/{held.id}")
    assert r.status_code == 200
    assert r.json()["moderation_status"] == "pending"


async def test_missing_question_is_404(client):
    assert (await client.get(f"/api/questions/{uuid.uuid4()}")).status_code == 404
