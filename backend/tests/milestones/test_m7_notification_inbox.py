"""Milestone 7 — C-03 notification bell's data source is fed by every lane.

FAILS while the notification emitters are no-ops: the inbox/unread-count that the
bell polls stays empty even after cross-lane events. Once C-01 is wired, events
originating in Lane C (friend request) and Lane B (answer) both land in one inbox.
"""

ANSWER_BODY = "A thorough, sufficiently long answer that should notify the asker."


async def test_inbox_aggregates_events_from_multiple_lanes(auth_client, factory):
    me_c, me = await auth_client(username="hub")

                                                      
    requester_c, _ = await auth_client(username="new_friend")
    await requester_c.post("/api/friends/request", json={"addressee_id": str(me.id)})

                                                
    q = await factory.question(author=me)
    responder_c, _ = await auth_client(username="helper")
    await responder_c.post(f"/api/questions/{q.id}/answers", json={"body": ANSWER_BODY})

    unread = await me_c.get("/api/notifications/unread-count")
    assert unread.json()["count"] == 2

    inbox = await me_c.get("/api/notifications")
    events = {n["event_type"] for n in inbox.json()["items"]}
    assert {"friend_request", "answer_created"} <= events
