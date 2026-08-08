"""B-03 — Question feed / list."""


async def test_feed_newest_first_and_paginates(client, factory):
    author = await factory.user()
    for i in range(3):
        await factory.question(author=author, title=f"Feed question number {i} that is long enough")

    r = await client.get("/api/questions?sort=newest&page=1&limit=2")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 3
    assert len(body["items"]) == 2
    # Newest first: created last appears first.
    assert body["items"][0]["created_at"] >= body["items"][1]["created_at"]


async def test_unanswered_filter_excludes_answered(client, factory):
    author = await factory.user()
    answered = await factory.question(author=author, title="This question already has an approved answer here")
    await factory.answer(question=answered, author=author, moderation_status="approved")
    await factory.question(author=author, title="This lonely question has no answers at all yet")

    r = await client.get("/api/questions?sort=unanswered")
    assert r.status_code == 200
    titles = [q["title"] for q in r.json()["items"]]
    assert "This lonely question has no answers at all yet" in titles
    assert "This question already has an approved answer here" not in titles


async def test_held_questions_are_hidden_from_the_feed(client, factory):
    author = await factory.user()
    await factory.question(author=author, moderation_status="pending",
                           title="A held question that strangers must never see here")
    r = await client.get("/api/questions")
    assert r.json()["total"] == 0
