"""A-08 — Profile edit (PUT /api/users/me)."""


async def test_update_username_and_bio(alice):
    r = await alice.client.put("/api/users/me", json={"username": "alice2", "bio": "  hi there  "})
    assert r.status_code == 200
    body = r.json()
    assert body["username"] == "alice2"
    assert body["bio"] == "hi there"  # trimmed


async def test_empty_bio_becomes_null(alice):
    r = await alice.client.put("/api/users/me", json={"bio": "   "})
    assert r.status_code == 200
    assert r.json()["bio"] is None


async def test_bio_too_long_is_400(alice):
    r = await alice.client.put("/api/users/me", json={"bio": "x" * 501})
    assert r.status_code == 400
    assert "bio" in r.json()["error"]["fields"]


async def test_taken_username_is_409(auth_client, factory):
    await factory.user(username="occupied")
    c, _ = await auth_client(username="mover")
    r = await c.put("/api/users/me", json={"username": "occupied"})
    assert r.status_code == 409
    assert r.json()["error"]["fields"]["username"]


async def test_partial_update_leaves_other_fields(alice):
    await alice.client.put("/api/users/me", json={"bio": "keep me"})
    r = await alice.client.put("/api/users/me", json={"username": "renamed"})
    assert r.status_code == 200
    assert r.json()["bio"] == "keep me"
    assert r.json()["username"] == "renamed"
