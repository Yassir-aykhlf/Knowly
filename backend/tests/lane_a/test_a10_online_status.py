"""A-10 — Online status (heartbeat)."""
from datetime import datetime, timedelta

from sqlalchemy import select

from app.models.user import User


async def test_heartbeat_updates_last_seen(auth_client, factory, db):
    c, user = await auth_client(username="beater")
    uid = user.id
    # Age last_seen well beyond the 30s throttle window.
    user.last_seen = datetime.utcnow() - timedelta(minutes=10)
    await factory.db.commit()

    r = await c.post("/api/users/me/heartbeat")
    assert r.status_code == 204

    db.expire_all()  # drop cached instances so the re-query reads the committed row
    fresh = (await db.execute(select(User).where(User.id == uid))).scalar_one()
    assert fresh.last_seen > datetime.utcnow() - timedelta(seconds=30)


async def test_heartbeat_within_window_is_a_noop_204(auth_client, factory, db):
    c, user = await auth_client(username="throttled")
    uid = user.id
    recent = datetime.utcnow() - timedelta(seconds=5)
    user.last_seen = recent
    await factory.db.commit()

    r = await c.post("/api/users/me/heartbeat")
    # Throttled beats never error — always 204 — and do not move last_seen.
    assert r.status_code == 204
    db.expire_all()
    fresh = (await db.execute(select(User).where(User.id == uid))).scalar_one()
    assert abs((fresh.last_seen - recent).total_seconds()) < 1
