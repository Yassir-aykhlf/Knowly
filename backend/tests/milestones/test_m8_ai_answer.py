"""Milestone 8 — D-05 "use this as my answer" ↔ B-06 answer create.

FAILS until B-06 honors the AI-conversation link: an answer submitted from a
conversation the caller owns is badged AI-assisted, while a conversation that
belongs to someone else is ignored (never cross-attributed).
"""

BODY = "This answer was drafted with the assistant and is long enough to be valid."


async def test_answer_from_own_conversation_is_ai_assisted(auth_client, factory):
    author_c, author = await auth_client(username="ai_answerer")
    q = await factory.question(author=await factory.user())
    conv = await factory.ai_conversation(user=author)

    r = await author_c.post(f"/api/questions/{q.id}/answers", json={
        "body": BODY, "is_ai_assisted": True, "from_conversation_id": str(conv.id),
    })
    assert r.status_code == 201
    assert r.json()["is_ai_assisted"] is True


async def test_answer_from_foreign_conversation_is_not_ai_assisted(auth_client, factory):
    author_c, author = await auth_client(username="ai_answerer2")
    q = await factory.question(author=await factory.user())
    someone_else = await factory.user()
    foreign_conv = await factory.ai_conversation(user=someone_else)

    r = await author_c.post(f"/api/questions/{q.id}/answers", json={
        "body": BODY, "is_ai_assisted": True, "from_conversation_id": str(foreign_conv.id),
    })
    assert r.status_code == 201
                                                                       
    assert r.json()["is_ai_assisted"] is False
