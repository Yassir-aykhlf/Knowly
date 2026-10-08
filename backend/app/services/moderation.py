import asyncio
import hashlib
import json
import logging
import math
from collections import OrderedDict
from dataclasses import dataclass, field

import httpx

from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.services import notifications

logger = logging.getLogger("knowly.moderation")
MODERATION_URL = "https://api.openai.com/v1/moderations"
CACHE_MAX_SIZE = 1024
_cache: OrderedDict[str, dict[str, float]] = OrderedDict()
_pending: dict[str, tuple[asyncio.Lock, int]] = {}


def _thresholds() -> dict[str, float]:
    raw = settings.MODERATION_THRESHOLD_OVERRIDES
    overrides = json.loads(raw) if raw.strip() else {}
    if not isinstance(overrides, dict):
        raise ValueError("Moderation overrides must be a JSON object")
    for value in [settings.MODERATION_THRESHOLD, *overrides.values()]:
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError("Moderation thresholds must be numbers")
        if not math.isfinite(value) or not 0 <= value <= 1:
            raise ValueError("Moderation thresholds must be between zero and one")
    return overrides


@dataclass
class ModerationResult:
    flagged: bool
    categories: dict = field(default_factory=dict)
    reason: str | None = None


def evaluate_scores(categories: dict) -> tuple[bool, str | None]:
    overrides = _thresholds()
    offending = sorted(
        ((name, score) for name, score in categories.items()
         if score >= overrides.get(name, settings.MODERATION_THRESHOLD)),
        key=lambda item: (-item[1], item[0]),
    )
    if not offending:
        return False, None
    reason = ", ".join(f"{name} ({score:.2f})" for name, score in offending[:3])
    return True, f"Flagged by automated moderation: {reason}"


async def _fetch_scores(text: str) -> dict[str, float]:
    if not settings.LLM_API_KEY or settings.LLM_PROVIDER != "openai":
        raise ValueError("Moderation provider is not configured")
    async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=5.0)) as client:
        response = await client.post(
            MODERATION_URL,
            headers={"Authorization": f"Bearer {settings.LLM_API_KEY}"},
            json={"model": "omni-moderation-latest", "input": text},
        )
        response.raise_for_status()
        scores = response.json()["results"][0]["category_scores"]
    if not isinstance(scores, dict) or not scores:
        raise ValueError("Invalid moderation scores")
    for name, score in scores.items():
        if not isinstance(name, str) or isinstance(score, bool):
            raise ValueError("Invalid moderation scores")
        if not isinstance(score, (int, float)) or not math.isfinite(score) or not 0 <= score <= 1:
            raise ValueError("Invalid moderation scores")
    return scores


async def moderate(text: str) -> ModerationResult:
    if not settings.MODERATION_ENABLED:
        return ModerationResult(flagged=False)
    digest = hashlib.sha256(text.encode("utf-8")).hexdigest()
    lock, waiters = _pending.get(digest, (asyncio.Lock(), 0))
    _pending[digest] = (lock, waiters + 1)
    try:
        async with lock:
            scores = _cache.get(digest)
            if scores is None:
                scores = await _fetch_scores(text)
                flagged, reason = evaluate_scores(scores)
                _cache[digest] = dict(scores)
                while len(_cache) > CACHE_MAX_SIZE:
                    _cache.popitem(last=False)
            else:
                flagged, reason = evaluate_scores(scores)
            _cache.move_to_end(digest)
        return ModerationResult(flagged=flagged, categories=dict(scores), reason=reason)
    except Exception:
        logger.warning("Moderation screening failed; allowing content without caching a verdict")
        return ModerationResult(flagged=False)
    finally:
        _, waiters = _pending[digest]
        if waiters == 1:
            del _pending[digest]
        else:
            _pending[digest] = (lock, waiters - 1)


async def screen(text: str) -> tuple[str, str | None]:
    result = await moderate(text)
    return ("pending", result.reason) if result.flagged else ("approved", None)


async def screen_and_stage(
    db: AsyncSession,
    *,
    kind: str,
    obj,
    text: str,
    question_id=None,
    parent_author_id=None,
    editing: bool = False,
    question_author_id=None,
) -> None:
    previous_status = obj.moderation_status if editing else None
    obj.moderation_status, obj.moderation_note = await screen(text)
    await db.flush()
    if kind == "question":
        question_id = obj.id
    if question_id is None:
        raise ValueError("A question context is required for moderation notifications")

    if obj.moderation_status == "pending":
        if previous_status != "pending":
            await notifications.create_notification(
                db, recipient_id=obj.author_id, actor_id=None,
                event_type="moderation_pending", subject_type=kind,
                subject_id=obj.id, link=f"/questions/{question_id}",
            )
        return

    await notifications.emit_content_approved(
        db, kind=kind, obj=obj, question_id=question_id,
        parent_author_id=parent_author_id,
    )
    if editing and previous_status == "approved" and question_author_id is not None:
        await notifications.notify_content_edited(
            db, kind=kind, obj=obj, question_id=question_id,
            question_author_id=question_author_id, actor_id=obj.author_id,
        )
