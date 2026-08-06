"""Milestone 3 — C-01 notification write-seam replaces B's no-op stub.

FAILS while ``notifications.create_notification`` (and friends) are no-ops: no
rows are staged, so the target author's inbox stays empty. Real emitters make
votes and answers produce notifications.
"""

ANSWER_BODY = "Here is a genuinely useful and sufficiently long answer to your question."


async def test_first_vote_creates_a_coalesced_notification(auth_client, factory):
    author_c, author = await auth_client(username="votee")
    q = await factory.question(author=author)

    voter_c, _ = await auth_client(username="voter")
    await voter_c.post(f"/api/questions/{q.id}/vote", json={"value": 1})

    inbox = await author_c.get("/api/notifications")
    assert inbox.json()["total"] == 1
    assert inbox.json()["items"][0]["event_type"] == "vote_cast"


async def test_new_answer_notifies_the_question_author(auth_client, factory):
    author_c, author = await auth_client(username="asker")
    q = await factory.question(author=author)

    responder_c, _ = await auth_client(username="responder")
    r = await responder_c.post(f"/api/questions/{q.id}/answers", json={"body": ANSWER_BODY})
    assert r.status_code == 201

    inbox = await author_c.get("/api/notifications")
    events = [n["event_type"] for n in inbox.json()["items"]]
    assert "answer_created" in events
