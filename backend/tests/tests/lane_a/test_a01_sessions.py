"""A-01 — Sessions + the auth dependency (get_current_user).

Lane-local: only asserts that a valid session cookie authenticates and its
absence 401s. (Real cross-lane enforcement is milestone m1.)
"""


async def test_me_requires_a_session(client):
    r = await client.get("/api/users/me")
    assert r.status_code == 401
    assert r.json()["error"]["code"] == "unauthenticated"


async def test_valid_session_cookie_authenticates(auth_client):
    c, user = await auth_client(username="sessiontest")
    r = await c.get("/api/users/me")
    assert r.status_code == 200
    assert r.json()["id"] == str(user.id)


async def test_unknown_cookie_is_unauthenticated(client):
    client.cookies.set("knowly_session", "not-a-real-token")
    r = await client.get("/api/users/me")
    assert r.status_code == 401
