"""A-05 — Current user + password change."""
from datetime import datetime, timedelta

from app.models.session import Session as UserSession


async def test_get_me_returns_own_record(alice):
    r = await alice.client.get("/api/users/me")
    assert r.status_code == 200
    body = r.json()
    assert body["username"] == "alice"
    assert set(["id", "email", "username", "role", "has_password", "is_anonymized"]).issubset(body)


async def test_password_change_wrong_current_is_401(alice):
    r = await alice.client.put(
        "/api/users/me/password",
        json={"current_password": "WrongPass9", "new_password": "BrandNew12"},
    )
    assert r.status_code == 401
    assert r.json()["error"]["fields"]["current_password"]


async def test_password_change_validates_new_password(alice):
    r = await alice.client.put(
        "/api/users/me/password",
        json={"current_password": "Passw0rd1", "new_password": "short"},
    )
    assert r.status_code == 400
    assert "new_password" in r.json()["error"]["fields"]


async def test_password_change_invalidates_other_sessions_but_keeps_current(
    auth_client, client_factory, factory, db
):
    c1, user = await auth_client(username="multi", password="Passw0rd1")
    # A second live session for the same user, on another device.
    c2 = await client_factory()
    raw2 = await factory.session_token(user)
    c2.cookies.set("knowly_session", raw2)
    assert (await c2.get("/api/users/me")).status_code == 200

    r = await c1.put(
        "/api/users/me/password",
        json={"current_password": "Passw0rd1", "new_password": "BrandNew12"},
    )
    assert r.status_code == 204
    # Current session still valid; the other device is logged out.
    assert (await c1.get("/api/users/me")).status_code == 200
    assert (await c2.get("/api/users/me")).status_code == 401
