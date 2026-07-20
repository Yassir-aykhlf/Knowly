"""Milestone 1 — A-01 real auth dependency is wired everywhere.

FAILS while the Launch Pad's fixed-dev-user auth stub is still in place: the stub
returns a user for every request (so no 401) and admits everyone as admin (so no
403). These assertions only hold once real sessions + require_admin ship.
"""


async def test_protected_route_401s_without_a_session(client):
    assert (await client.get("/api/users/me")).status_code == 401
    assert (await client.get("/api/notifications")).status_code == 401


async def test_admin_route_forbids_non_admins(auth_client):
    user_c, _ = await auth_client(role="user")
    assert (await user_c.get("/api/moderation/pending")).status_code == 403

    admin_c, _ = await auth_client(role="admin")
    assert (await admin_c.get("/api/moderation/pending")).status_code == 200
