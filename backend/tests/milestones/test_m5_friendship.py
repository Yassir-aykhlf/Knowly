"""Milestone 5 — C-07 friendship_state_for replaces A's ("none", None) stub.

FAILS while the profile embeds the stubbed friendship state: it always reports
"none". Once the real seam is wired, the profile reflects the live relationship
from each side.
"""


async def test_profile_reflects_live_friendship_state_from_both_sides(auth_client, factory):
    alice_c, alice = await auth_client(username="alice")
    bob_c, bob = await auth_client(username="bob")

    r = await alice_c.post("/api/friends/request", json={"addressee_id": str(bob.id)})
    assert r.status_code == 201

                                                                 
    alice_view = await alice_c.get(f"/api/users/{bob.id}")
    assert alice_view.json()["friendship"]["state"] == "request_sent"

                                                                     
    bob_view = await bob_c.get(f"/api/users/{alice.id}")
    assert bob_view.json()["friendship"]["state"] == "incoming_pending"
