import asyncio
import hashlib
from datetime import datetime, timedelta
from unittest.mock import AsyncMock

import httpx
import pytest
from sqlalchemy import select

from app.models.answer import Answer
from app.models.notification import Notification
from app.models.question import Question
from app.services import moderation, screening


@pytest.fixture(autouse=True)
def moderation_config(monkeypatch):
    monkeypatch.setattr(moderation.settings, "MODERATION_ENABLED", True)
    monkeypatch.setattr(moderation.settings, "MODERATION_THRESHOLD", 0.5)
    monkeypatch.setattr(moderation.settings, "MODERATION_THRESHOLD_OVERRIDES", "")
    monkeypatch.setattr(moderation.settings, "LLM_API_KEY", "test-secret-never-log")
    monkeypatch.setattr(moderation.settings, "LLM_PROVIDER", "openai")
    moderation._cache.clear()
    monkeypatch.setattr(moderation, "_pending", {})
    yield
    moderation._cache.clear()


def test_threshold_override_boundary_and_order(monkeypatch):
    monkeypatch.setattr(moderation.settings, "MODERATION_THRESHOLD_OVERRIDES",
                        '{"harassment": 0.1}')
    flagged, reason = moderation.evaluate_scores({"harassment": 0.1, "hate": 0.9})
    assert flagged and reason.index("hate") < reason.index("harassment")
    assert moderation.evaluate_scores({"violence": 0.5})[0]


async def test_disabled_does_not_call_provider_or_use_cache(monkeypatch):
    fetch = AsyncMock(return_value={"hate": 0.9})
    monkeypatch.setattr(moderation, "_fetch_scores", fetch)
    await moderation.moderate("same")
    monkeypatch.setattr(moderation.settings, "MODERATION_ENABLED", False)
    assert not (await moderation.moderate("same")).flagged
    assert fetch.await_count == 1


async def test_lru_is_bounded_hashed_and_rechecks_thresholds(monkeypatch):
    fetch = AsyncMock(return_value={"harassment": 0.2})
    monkeypatch.setattr(moderation, "_fetch_scores", fetch)
    monkeypatch.setattr(moderation, "CACHE_MAX_SIZE", 2)
    first = await moderation.moderate("private first")
    first.categories["harassment"] = 1
    await moderation.moderate("second")
    monkeypatch.setattr(moderation.settings, "MODERATION_THRESHOLD_OVERRIDES",
                        '{"harassment": 0.1}')
    assert (await moderation.moderate("private first")).flagged
    await moderation.moderate("third")
    assert list(moderation._cache) == [
        hashlib.sha256(text.encode()).hexdigest() for text in ("private first", "third")
    ]
    await moderation.moderate("second")
    assert fetch.await_count == 4


async def test_concurrent_identical_text_calls_provider_once(monkeypatch):
    async def fetch(text):
        await asyncio.sleep(0)
        return {"hate": 0.9}
    mock = AsyncMock(side_effect=fetch)
    monkeypatch.setattr(moderation, "_fetch_scores", mock)
    results = await asyncio.gather(*(moderation.moderate("same") for _ in range(3)))
    assert all(result.flagged for result in results)
    assert mock.await_count == 1
    assert not moderation._pending


async def test_unrelated_texts_can_be_screened_concurrently(monkeypatch):
    started = []
    async def fetch(text):
        started.append(text)
        await asyncio.sleep(0)
        assert len(started) == 2
        return {"hate": 0.9}
    monkeypatch.setattr(moderation, "_fetch_scores", fetch)
    results = await asyncio.gather(moderation.moderate("one"), moderation.moderate("two"))
    assert all(result.flagged for result in results)


@pytest.mark.parametrize("failure", [httpx.ConnectError, httpx.ReadTimeout, ValueError])
async def test_failures_are_not_cached_or_logged_verbatim(monkeypatch, caplog, failure):
    fetch = AsyncMock(side_effect=failure("test-secret-never-log private text"))
    monkeypatch.setattr(moderation, "_fetch_scores", fetch)
    for _ in range(2):
        assert not (await moderation.moderate("private text")).flagged
    assert fetch.await_count == 2 and not moderation._cache
    assert "screening failed" in caplog.text
    assert "test-secret-never-log" not in caplog.text
    assert "private text" not in caplog.text


async def test_provider_request_uses_scores_not_provider_flag(monkeypatch):
    requests = []
    def respond(request):
        requests.append(request)
        return httpx.Response(200, json={"results": [{
            "flagged": False, "category_scores": {"harassment": 0.9},
        }]})
    client_class = httpx.AsyncClient
    monkeypatch.setattr(moderation.httpx, "AsyncClient", lambda **kwargs:
                        client_class(transport=httpx.MockTransport(respond), **kwargs))
    assert (await moderation.moderate("text")).flagged
    assert requests[0].url == moderation.MODERATION_URL
    assert requests[0].headers["Authorization"] == "Bearer test-secret-never-log"
    assert b'"model": "omni-moderation-latest"' in requests[0].content


@pytest.mark.parametrize("payload", [
    {"results": []}, {"results": [{"category_scores": {}}]},
    {"results": [{"category_scores": {"hate": "invalid"}}]},
])
async def test_malformed_provider_response_fails_open(monkeypatch, payload):
    client_class = httpx.AsyncClient
    transport = httpx.MockTransport(lambda request: httpx.Response(200, json=payload))
    monkeypatch.setattr(moderation.httpx, "AsyncClient", lambda **kwargs:
                        client_class(transport=transport, **kwargs))
    assert not (await moderation.moderate("text")).flagged
    assert not moderation._cache


async def test_http_error_fails_open_and_retries(monkeypatch, caplog):
    calls = []
    def respond(request):
        calls.append(request)
        return httpx.Response(429, text="test-secret-never-log private text")
    client_class = httpx.AsyncClient
    monkeypatch.setattr(moderation.httpx, "AsyncClient", lambda **kwargs:
                        client_class(transport=httpx.MockTransport(respond), **kwargs))
    for _ in range(2):
        assert not (await moderation.moderate("text")).flagged
    assert len(calls) == 2 and not moderation._cache
    assert "test-secret-never-log" not in caplog.text


async def test_invalid_overrides_fail_open_without_caching(monkeypatch):
    monkeypatch.setattr(moderation.settings, "MODERATION_THRESHOLD_OVERRIDES", "[]")
    monkeypatch.setattr(moderation, "_fetch_scores", AsyncMock(return_value={"hate": 0.9}))
    assert not (await moderation.moderate("text")).flagged
    assert not moderation._cache


@pytest.mark.parametrize("previous,flagged,expected", [
    (None, True, ["moderation_pending"]),
    ("pending", True, []),
    ("approved", True, ["moderation_pending"]),
    ("rejected", True, ["moderation_pending"]),
    (None, False, ["answer_created", "mentioned"]),
    ("pending", False, ["answer_created", "mentioned"]),
    ("approved", False, ["answer_created", "content_edited", "mentioned"]),
])
async def test_notifications_follow_visibility_transition(
    factory, db, moderation_flags, previous, flagged, expected,
):
    asker = await factory.user()
    author = await factory.user()
    mentioned = await factory.user(username="mentioned_user")
    question = await factory.question(author=asker)
    body = f"A sufficiently long answer which mentions @{mentioned.username} for context."
    if flagged:
        body += moderation_flags.sentinel
    answer = Answer(
        author_id=author.id, question_id=question.id, body=body,
        moderation_status=previous or "approved",
        created_at=datetime.utcnow() - timedelta(days=1),
    )
    db.add(answer)
    await screening.screen_and_stage(
        db, kind="answer", obj=answer, text=body,
        question_id=question.id, parent_author_id=asker.id,
        editing=previous is not None, question_author_id=asker.id,
    )
    events = (await db.execute(select(Notification))).scalars().all()
    assert sorted(event.event_type for event in events) == expected
    for event in events:
        assert event.link == f"/questions/{question.id}"
        if event.event_type == "moderation_pending":
            assert event.recipient_id == author.id and event.actor_id is None


async def test_pending_edit_stays_silent_and_rollback_removes_everything(
    factory, db, moderation_flags,
):
    author = await factory.user()
    question = Question(
        author_id=author.id, title="A sufficiently long question title",
        body=f"A sufficiently long body containing {moderation_flags.sentinel}.",
    )
    db.add(question)
    await moderation.screen_and_stage(db, kind="question", obj=question, text=question.body)
    question_id = question.id
    await moderation.screen_and_stage(
        db, kind="question", obj=question, text=question.body, editing=True,
    )
    assert len((await db.execute(select(Notification))).scalars().all()) == 1
    await db.rollback()
    assert await db.get(Question, question_id) is None
    assert not (await db.execute(select(Notification))).scalars().all()
