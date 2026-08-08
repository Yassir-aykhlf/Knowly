"""C-07 — Friend listings + state seam."""
from datetime import datetime, timedelta

from app.services import friends as friends_service


async def test_friends_list_derives_online_from_last_seen(auth_client, factory):
    me = await factory.user(username="hub")
    online_friend = await factory.user(username="online_pal")
    offline_friend = await factory.user(username="offline_pal")
    # Online window is 2 minutes.
    online_friend.last_seen = datetime.utcnow()
    offline_friend.last_seen = datetime.utcnow() - timedelta(minutes=10)
    await factory.friendship(requester=me, addressee=online_friend, status="accepted")
    await factory.friendship(requester=offline_friend, addressee=me, status="accepted")
    await factory.db.commit()

    c, _ = await auth_client(user=me)
    r = await c.get("/api/friends")
    assert r.status_code == 200
    by_name = {f["user"]["username"]: f["online"] for f in r.json()}
    assert by_name["online_pal"] is True
    assert by_name["offline_pal"] is False


async def test_pending_lists_incoming_only(auth_client, factory):
    me = await factory.user(username="pendinghub")
    incoming = await factory.user(username="incoming_req")
    await factory.friendship(requester=incoming, addressee=me, status="pending")
    # An outgoing request must NOT show in my pending (incoming) list.
    outgoing = await factory.user(username="outgoing_req")
    await factory.friendship(requester=me, addressee=outgoing, status="pending")

    c, _ = await auth_client(user=me)
    r = await c.get("/api/friends/pending")
    names = [p["requester"]["username"] for p in r.json()]
    assert names == ["incoming_req"]


async def test_friendship_state_for_seam(factory, db):
    a = await factory.user()
    b = await factory.user()
    # No relationship yet.
    state, fid = await friends_service.friendship_state_for(db, a, b.id)
    assert state == "none" and fid is None
    # After an accepted friendship.
    await factory.friendship(requester=a, addressee=b, status="accepted")
    state, fid = await friends_service.friendship_state_for(db, a, b.id)
    assert state == "friends" and fid is not None
