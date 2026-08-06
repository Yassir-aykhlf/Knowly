"""B-02 — Create question. Content is born approved (lane-local)."""

VALID = {
    "title": "How do I structure a FastAPI project cleanly?",
    "body": "I want routers, services and schemas separated but I am not sure how to wire them.",
    "tags": ["fastapi", "python"],
}


async def test_create_returns_full_detail(alice):
    r = await alice.client.post("/api/questions", json=VALID)
    assert r.status_code == 201
    body = r.json()
    assert body["title"] == VALID["title"]
    assert body["tags"] == ["fastapi", "python"]
    assert body["author"]["username"] == "alice"
    assert body["moderation_status"] == "approved"
    assert body["answers"] == [] and body["comments"] == []
    assert body["vote_total"] == 0 and body["view_count"] == 0


async def test_create_requires_auth(client):
    r = await client.post("/api/questions", json=VALID)
    assert r.status_code == 401


async def test_title_too_short_is_rejected(alice):
    r = await alice.client.post("/api/questions", json={**VALID, "title": "too short"})
    assert r.status_code == 400
    assert "title" in r.json()["error"]["fields"]


async def test_body_too_short_is_rejected(alice):
    r = await alice.client.post("/api/questions", json={**VALID, "body": "nope"})
    assert r.status_code == 400
    assert "body" in r.json()["error"]["fields"]


async def test_too_many_tags_is_rejected(alice):
    r = await alice.client.post("/api/questions", json={**VALID, "tags": ["a2", "b2", "c2", "d2", "e2", "f2"]})
    assert r.status_code == 400
    assert "tags" in r.json()["error"]["fields"]
