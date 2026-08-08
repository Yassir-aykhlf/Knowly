"""A-13 — Google OAuth sign-in (start + callback redirects).

OAuth is unconfigured in the test env, so we assert the safe redirect behavior
(never a 500) rather than a live Google round-trip.
"""


async def test_start_unconfigured_bounces_to_login(client):
    r = await client.get("/api/auth/google", follow_redirects=False)
    assert r.status_code == 302
    assert "/login?oauth_error=unconfigured" in r.headers["location"]


async def test_callback_without_code_or_state_is_rejected(client):
    r = await client.get("/api/auth/google/callback", follow_redirects=False)
    assert r.status_code == 302
    assert "oauth_error=state" in r.headers["location"]


async def test_callback_with_mismatched_state_is_rejected(client):
    r = await client.get(
        "/api/auth/google/callback?code=abc&state=forged", follow_redirects=False
    )
    assert r.status_code == 302
    assert "oauth_error=state" in r.headers["location"]
