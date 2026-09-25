"""A-07 — Profile contribution listings."""
import uuid


async def test_questions_listing_paginates_and_shapes_cards(client, factory):
    target = await factory.user(username="lister")
    for i in range(3):
        await factory.question(author=target, title=f"A perfectly valid question number {i} here")

    r = await client.get(f"/api/users/{target.id}/questions?page=1&limit=2")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 3
    assert len(body["items"]) == 2
    card = body["items"][0]
    assert set(["id", "title", "excerpt", "tags", "author", "vote_total",
                "answer_count", "view_count", "has_accepted_answer", "created_at"]).issubset(card)


async def test_unknown_user_listing_is_404(client):
    r = await client.get(f"/api/users/{uuid.uuid4()}/questions")
    assert r.status_code == 404


async def test_answers_listing_masks_hidden_parent_question(client, factory):
    # An approved answer hanging off a PENDING question must not leak the
    # question's title to a stranger — it shows "(removed question)".
    author = await factory.user(username="answerer")
    hidden_q = await factory.question(
        author=author, title="Secret pending title nobody should see here",
        moderation_status="pending",
    )
    await factory.answer(question=hidden_q, author=author)

    r = await client.get(f"/api/users/{author.id}/answers")
    assert r.status_code == 200
    items = r.json()["items"]
    assert len(items) == 1
    assert items[0]["question_title"] == "(removed question)"
    assert items[0]["is_accepted"] is False
