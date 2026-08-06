"""A-14 — OAuth account linking (link-or-cancel)."""


async def test_link_without_pending_cookie_is_expired(client):
    r = await client.post("/api/auth/google/link", json={"password": "Passw0rd1"})
    assert r.status_code == 400
    assert r.json()["error"]["code"] == "link_expired"


async def test_cancel_link_is_204(client):
    r = await client.request("DELETE", "/api/auth/google/link")
    assert r.status_code == 204
