"""Milestone 2 — B-01 content seam replaces the visibility stub in A/D.

FAILS while ``content.visible_filter`` is the approved-only stub: the stub can't
express "the author also sees their own held content," so the owner's counts
match a stranger's. The real seam makes them differ.
"""


async def test_owner_sees_own_held_content_in_counts_but_strangers_do_not(client, auth_client, factory):
    target = await factory.user(username="carol")
    await factory.question(author=target, moderation_status="approved")
    await factory.question(author=target, moderation_status="pending")

                                                      
    stranger_view = await client.get(f"/api/users/{target.id}")
    assert stranger_view.json()["question_count"] == 1

                                                       
    owner_c, _ = await auth_client(user=target)
    owner_view = await owner_c.get(f"/api/users/{target.id}")
    assert owner_view.json()["question_count"] == 2
