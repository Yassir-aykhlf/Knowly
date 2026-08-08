"""C-05 — Friend requests."""
import uuid


async def test_send_request_creates_pending(auth_client, factory):
    addressee = await factory.user(username="target")
    c, _ = await auth_client(username="requester")
    r = await c.post("/api/friends/request", json={"addressee_id": str(addressee.id)})
    assert r.status_code == 201
    assert r.json()["status"] == "pending"


async def test_cannot_friend_yourself(alice):
    r = await alice.client.post("/api/friends/request", json={"addressee_id": str(alice.user.id)})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "invalid_request"


async def test_unknown_addressee_is_404(alice):
    r = await alice.client.post("/api/friends/request", json={"addressee_id": str(uuid.uuid4())})
    assert r.status_code == 404


async def test_duplicate_pending_request_conflicts(auth_client, factory):
    requester = await factory.user(username="dup_req")
    addressee = await factory.user(username="dup_addr")
    await factory.friendship(requester=requester, addressee=addressee, status="pending")
    c, _ = await auth_client(user=requester)
    r = await c.post("/api/friends/request", json={"addressee_id": str(addressee.id)})
    assert r.status_code == 409


async def test_rerequest_after_rejection_flips_to_pending(auth_client, factory):
    requester = await factory.user(username="rereq")
    addressee = await factory.user(username="readdr")
    await factory.friendship(requester=requester, addressee=addressee, status="rejected")
    c, _ = await auth_client(user=requester)
    r = await c.post("/api/friends/request", json={"addressee_id": str(addressee.id)})
    assert r.status_code == 201
    assert r.json()["status"] == "pending"
