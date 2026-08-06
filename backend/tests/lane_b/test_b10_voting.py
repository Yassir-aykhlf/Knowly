"""B-10 — Voting (self-vote block, optimistic totals).

Lane-local: asserts the vote result only, never the notification side effect
(that is milestone m3).
"""


async def test_vote_on_others_question_updates_total(auth_client, factory):
    author = await factory.user()
    q = await factory.question(author=author)
    voter_c, _ = await auth_client(username="voter1")

    up = await voter_c.post(f"/api/questions/{q.id}/vote", json={"value": 1})
    assert up.status_code == 200
    assert up.json() == {"vote_total": 1, "my_vote": 1}

    # Clearing (same value) zeroes it out.
    clear = await voter_c.post(f"/api/questions/{q.id}/vote", json={"value": 1})
    # value:1 again is an explicit set to 1, not a clear at the API level; the
    # "click again to clear" is a frontend concept. Sending 0 clears server-side.
    zero = await voter_c.post(f"/api/questions/{q.id}/vote", json={"value": 0})
    assert zero.json() == {"vote_total": 0, "my_vote": 0}


async def test_cannot_vote_on_own_question(auth_client, factory):
    author = await factory.user(username="selfvoter")
    q = await factory.question(author=author)
    author_c, _ = await auth_client(user=author)
    r = await author_c.post(f"/api/questions/{q.id}/vote", json={"value": 1})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "self_vote"


async def test_cannot_vote_on_own_answer(auth_client, factory):
    author = await factory.user(username="selfvoter2")
    q = await factory.question(author=await factory.user())
    a = await factory.answer(question=q, author=author)
    author_c, _ = await auth_client(user=author)
    r = await author_c.post(f"/api/answers/{a.id}/vote", json={"value": -1})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "self_vote"


async def test_downvote_and_switch(auth_client, factory):
    author = await factory.user()
    q = await factory.question(author=author)
    voter_c, _ = await auth_client(username="switcher")
    down = await voter_c.post(f"/api/questions/{q.id}/vote", json={"value": -1})
    assert down.json() == {"vote_total": -1, "my_vote": -1}
    up = await voter_c.post(f"/api/questions/{q.id}/vote", json={"value": 1})
    assert up.json() == {"vote_total": 1, "my_vote": 1}
