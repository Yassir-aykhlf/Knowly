"""A-02 — Registration (POST /api/auth/register).

Lane-local: asserts only the registration endpoint's own behavior.
"""


async def test_register_creates_account_and_logs_in(client):
    r = await client.post(
        "/api/auth/register",
        json={"email": "new@example.com", "username": "newbie", "password": "Passw0rd1"},
    )
    assert r.status_code == 201
    body = r.json()
    # Returns the caller's own record, never the password hash.
    assert body["email"] == "new@example.com"
    assert body["username"] == "newbie"
    assert body["role"] == "user"
    assert body["has_password"] is True
    assert body["is_anonymized"] is False
    assert "password" not in body and "password_hash" not in body
    # A session cookie was set → the caller is logged in.
    assert "knowly_session" in r.cookies


async def test_register_rejects_bad_username_and_password(client):
    bad_user = await client.post(
        "/api/auth/register",
        json={"email": "a@example.com", "username": "ab", "password": "Passw0rd1"},
    )
    assert bad_user.status_code == 400
    assert bad_user.json()["error"]["code"] == "validation_error"
    assert "username" in bad_user.json()["error"]["fields"]

    # Password with no digit.
    bad_pw = await client.post(
        "/api/auth/register",
        json={"email": "a@example.com", "username": "gooduser", "password": "password"},
    )
    assert bad_pw.status_code == 400
    assert "password" in bad_pw.json()["error"]["fields"]


async def test_register_conflict_reports_each_field(client, factory):
    await factory.user(username="taken", email="taken@example.com")

    dup_both = await client.post(
        "/api/auth/register",
        json={"email": "taken@example.com", "username": "taken", "password": "Passw0rd1"},
    )
    assert dup_both.status_code == 409
    fields = dup_both.json()["error"]["fields"]
    assert "email" in fields and "username" in fields


async def test_register_admin_bootstrap_by_email(client, monkeypatch):
    from app.config import settings

    monkeypatch.setattr(settings, "INITIAL_ADMIN_EMAIL", "boss@example.com")
    r = await client.post(
        "/api/auth/register",
        json={"email": "boss@example.com", "username": "boss", "password": "Passw0rd1"},
    )
    assert r.status_code == 201
    assert r.json()["role"] == "admin"
