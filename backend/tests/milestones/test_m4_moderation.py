"""Milestone 4 — D-02 moderation hook replaces B's approve stub.

FAILS while ``moderation.screen_and_stage`` is the ``("approved", None)`` stub:
flagged content would go straight to approved and stay visible, and no
``moderation_pending`` notification would fire. Uses the ``moderation_flags``
fixture to force a flag deterministically.
"""

FLAGGED_BODY_TEMPLATE = "This otherwise valid question body secretly contains {sentinel} inside it."


async def test_flagged_question_is_held_hidden_and_notified(auth_client, factory, moderation_flags):
    author_c, author = await auth_client(username="poster")
    body = FLAGGED_BODY_TEMPLATE.format(sentinel=moderation_flags.sentinel)

    created = await author_c.post("/api/questions", json={
        "title": "A question whose body will be flagged by moderation here",
        "body": body,
        "tags": [],
    })
    assert created.status_code == 201
    assert created.json()["moderation_status"] == "pending"
    qid = created.json()["id"]

                                               
    stranger_c, _ = await auth_client(username="stranger")
    assert (await stranger_c.get(f"/api/questions/{qid}")).status_code == 404

                                               
    inbox = await author_c.get("/api/notifications")
    events = [n["event_type"] for n in inbox.json()["items"]]
    assert "moderation_pending" in events
