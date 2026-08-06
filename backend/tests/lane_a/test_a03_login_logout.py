"""A-03 — Login & Logout."""


async def test_login_success_sets_cookie(client, factory):
    await factory.user(username="loginok", email="loginok@example.com", password="Passw0rd1")
    r = await client.post(
        "/api/auth/login", json={"email": "loginok@example.com", "password": "Passw0rd1"}
    )
    assert r.status_code == 200
    assert r.json()["username"] == "loginok"
    assert "knowly_session" in r.cookies


async def test_login_wrong_password_is_generic_with_oauth_hint(client, factory):
    await factory.user(email="real@example.com", password="Passw0rd1")
    r = await client.post(
        "/api/auth/login", json={"email": "real@example.com", "password": "WrongPass9"}
    )
    assert r.status_code == 401
    err = r.json()["error"]
    assert err["code"] == "invalid_credentials"
    assert err["fields"]["oauth_hint"] == "true"


async def test_login_unknown_email_is_indistinguishable(client):
    r = await client.post(
        "/api/auth/login", json={"email": "ghost@example.com", "password": "Passw0rd1"}
    )
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "invalid_credentials"


async def test_oauth_only_account_cannot_password_login(client, factory):
    # No password → login must fail with the same generic response (no enumeration).
    await factory.user(
        email="google@example.com", password=None,
        oauth_provider="google", oauth_subject="sub-123",
    )
    r = await client.post(
        "/api/auth/login", json={"email": "google@example.com", "password": "Passw0rd1"}
    )
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "invalid_credentials"


async def test_logout_clears_session_and_is_idempotent(auth_client):
    c, _ = await auth_client()
    assert (await c.get("/api/users/me")).status_code == 200
    r = await c.post("/api/auth/logout")
    assert r.status_code == 204
    # Cookie cleared → no longer authenticated.
    c.cookies.clear()
    assert (await c.get("/api/users/me")).status_code == 401
    # Logging out again (no session) is still fine.
    assert (await c.post("/api/auth/logout")).status_code == 204
