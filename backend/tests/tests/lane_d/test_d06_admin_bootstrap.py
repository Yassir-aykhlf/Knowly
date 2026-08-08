"""D-06 — Admin bootstrap (promote service)."""
from app.services.admin import promote_to_admin


async def test_promote_is_idempotent_and_case_insensitive(factory, db):
    user = await factory.user(email="promote@example.com", role="user")

    res = await promote_to_admin(db, "promote@example.com")
    assert res is not None and res.role == "admin"

    # Idempotent + case-insensitive email match.
    again = await promote_to_admin(db, "PROMOTE@example.com")
    assert again.role == "admin"


async def test_promote_unknown_email_returns_none(db):
    assert await promote_to_admin(db, "ghost@example.com") is None
