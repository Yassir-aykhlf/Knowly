"""D-11 — Search API (full-text, filters, highlight)."""


async def test_full_text_query_matches_and_highlights(client, factory):
    author = await factory.user()
    await factory.question(author=author, title="Deploying containers to Kubernetes clusters",
                           body="A guide about kubernetes autoscaling and rollout strategies today.")
    await factory.question(author=author, title="Baking sourdough bread at home",
                           body="Nothing at all to do with servers or infrastructure here friend.")

    r = await client.get("/api/search?q=kubernetes")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 1
    hit = body["items"][0]
    assert "Kubernetes" in hit["title"]
    assert "<mark>" in hit["highlight"]


async def test_tag_filter_uses_and_semantics(client, factory):
    author = await factory.user()
    await factory.question(author=author, title="A question tagged python and django here",
                           tags=["python", "django"])
    await factory.question(author=author, title="A question tagged python and flask here",
                           tags=["python", "flask"])

    both = await client.get("/api/search?tag=python&tag=django")
    assert both.json()["total"] == 1
    neither = await client.get("/api/search?tag=python&tag=rust")
    assert neither.json()["total"] == 0


async def test_author_filter(client, factory):
    alice = await factory.user(username="searchauthor")
    bob = await factory.user(username="otherauthor")
    await factory.question(author=alice, title="Alice wrote this particular question here today")
    await factory.question(author=bob, title="Bob wrote this different question here today too")

    r = await client.get("/api/search?author=searchauthor")
    assert r.json()["total"] == 1
    assert r.json()["items"][0]["author"]["username"] == "searchauthor"


async def test_held_questions_excluded_and_pagination(client, factory):
    author = await factory.user()
    for i in range(3):
        await factory.question(author=author, title=f"Visible searchable question number {i} here")
    await factory.question(author=author, moderation_status="pending",
                           title="Hidden held question that search must not return")

    r = await client.get("/api/search?page=1&limit=2")
    assert r.json()["total"] == 3  # the held one is excluded
    assert len(r.json()["items"]) == 2
