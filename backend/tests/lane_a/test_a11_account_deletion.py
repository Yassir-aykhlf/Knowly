"""A-11 — Account deletion (anonymization)."""
from sqlalchemy import func, select

from app.models.session import Session as UserSession
from app.models.user import User


async def test_delete_requires_correct_password(alice):
    r = await alice.client.request("DELETE", "/api/users/me", json={"password": "WrongPass9"})
    assert r.status_code == 401
    assert r.json()["error"]["fields"]["password"]


async def test_delete_anonymizes_in_place(auth_client, factory, db):
    c, user = await auth_client(username="leaving", password="Passw0rd1")
    uid = user.id

    r = await c.request("DELETE", "/api/users/me", json={"password": "Passw0rd1"})
    assert r.status_code == 204

    db.expire_all()  # read the committed, anonymized row (not the cached instance)
    row = (await db.execute(select(User).where(User.id == uid))).scalar_one()
    # UPDATE, not DELETE: the row survives, anonymized.
    assert row.is_anonymized is True
    assert row.username.startswith("[deleted_")
    assert row.email is None
    assert row.password_hash is None
    assert row.bio is None and row.avatar_path is None
    # Every session for the user was destroyed (logged out everywhere).
    n_sessions = (
        await db.execute(select(func.count()).select_from(UserSession).where(UserSession.user_id == uid))
    ).scalar_one()
    assert n_sessions == 0


async def test_oauth_only_account_requires_typed_confirmation(auth_client, factory):
    user = await factory.user(username="ghostacct", password=None,
                              oauth_provider="google", oauth_subject="sub-xyz")
    c, _ = await auth_client(user=user)
    # Missing/incorrect confirm → 400 confirmation_required.
    bad = await c.request("DELETE", "/api/users/me", json={"confirm": "nope"})
    assert bad.status_code == 400
    assert bad.json()["error"]["code"] == "confirmation_required"
    # Correct confirmation deletes.
    ok = await c.request("DELETE", "/api/users/me", json={"confirm": "DELETE"})
    assert ok.status_code == 204
