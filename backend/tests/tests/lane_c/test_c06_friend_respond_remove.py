"""C-06 — Friend respond & remove."""
from sqlalchemy import func, select

from app.models.friendship import Friendship


async def test_addressee_accepts(auth_client, factory):
    requester = await factory.user()
    addressee = await factory.user(username="accepter")
    f = await factory.friendship(requester=requester, addressee=addressee, status="pending")
    c, _ = await auth_client(user=addressee)
    r = await c.put(f"/api/friends/{f.id}/accept")
    assert r.status_code == 200
    assert r.json()["status"] == "accepted"


async def test_requester_cannot_accept_own_request(auth_client, factory):
    requester = await factory.user(username="selfaccept")
    addressee = await factory.user()
    f = await factory.friendship(requester=requester, addressee=addressee, status="pending")
    c, _ = await auth_client(user=requester)
    r = await c.put(f"/api/friends/{f.id}/accept")
    assert r.status_code == 403


async def test_reject_is_silent_and_keeps_row(auth_client, factory):
    requester = await factory.user()
    addressee = await factory.user(username="rejecter")
    f = await factory.friendship(requester=requester, addressee=addressee, status="pending")
    c, _ = await auth_client(user=addressee)
    r = await c.put(f"/api/friends/{f.id}/reject")
    assert r.status_code == 200
    assert r.json()["status"] == "rejected"


async def test_either_party_can_remove(auth_client, factory, db):
    requester = await factory.user()
    addressee = await factory.user(username="remover")
    f = await factory.friendship(requester=requester, addressee=addressee, status="accepted")
    c, _ = await auth_client(user=requester)
    r = await c.delete(f"/api/friends/{f.id}")
    assert r.status_code == 204
    db.expire_all()
    assert (await db.execute(select(func.count()).select_from(Friendship))).scalar_one() == 0
