import uuid
from datetime import datetime, timedelta

from sqlalchemy import func, select, text
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.notification import Notification
from app.models.user import User
from app.models.vote import Vote
from app.services.mentions import extract_mentions

IDEMPOTENT_EVENTS = frozenset({"answer_created", "comment_created", "mentioned"})

async def create_notification(
    db: AsyncSession,
    *,
    recipient_id: uuid.UUID,
    actor_id: uuid.UUID | None,
    event_type: str,
    link: str,
    subject_type: str | None = None,
    subject_id: uuid.UUID | None = None,
    coalesce_key: str | None = None,
) -> None:
    if actor_id is not None and actor_id == recipient_id:
        return
    if coalesce_key is not None:
        stmt = pg_insert(Notification).values(
            recipient_id=recipient_id, actor_id=actor_id, event_type=event_type,
            subject_type=subject_type, subject_id=subject_id, link=link,
            coalesce_key=coalesce_key, actor_count=1,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["recipient_id", "coalesce_key"],
            index_where=text("coalesce_key IS NOT NULL AND read_at IS NULL"),
            set_={
                "actor_count": Notification.actor_count + 1,
                "actor_id": stmt.excluded.actor_id,
                "created_at": func.now(),
            },
        )
        await db.execute(stmt)
        return
    if event_type in IDEMPOTENT_EVENTS:
        existing = await db.execute(
            select(Notification.id).where(
                Notification.recipient_id == recipient_id,
                Notification.event_type == event_type,
                Notification.subject_type == subject_type,
                Notification.subject_id == subject_id,
            ).limit(1)
        )
        if existing.scalar_one_or_none() is not None:
            return
    db.add(Notification(
        recipient_id=recipient_id, actor_id=actor_id, event_type=event_type,
        subject_type=subject_type, subject_id=subject_id, link=link,
        coalesce_key=coalesce_key,
    ))
async def emit_content_approved(
    db: AsyncSession, *, kind: str, obj, question_id: uuid.UUID, parent_author_id=None
) -> None:
    if obj.moderation_status != "approved":
        return
    link = f"/questions/{question_id}"
    if kind in ("answer", "comment") and parent_author_id is not None:
        event_type = "answer_created" if kind == "answer" else "comment_created"
        await create_notification(db, recipient_id=parent_author_id, actor_id=obj.author_id,
                                   event_type=event_type, subject_type=kind, subject_id=obj.id, link=link)
    usernames = extract_mentions(obj.body)
    if not usernames:
        return
    result = await db.execute(select(User).where(User.username.in_(usernames), User.is_anonymized.is_(False)))
    for u in result.scalars().all():
        await create_notification(db, recipient_id=u.id, actor_id=obj.author_id,
                                   event_type="mentioned", subject_type=kind, subject_id=obj.id, link=link)


async def notify_vote_if_new(
    db: AsyncSession,
    *,
    actor,
    target_type: str,
    target_id: uuid.UUID,
    target_author_id: uuid.UUID,
    question_id: uuid.UUID,
    value: int,
) -> None:
    if value == 0:
        return
    existing = await db.execute(
        select(Vote.id).where(Vote.voter_id == actor.id, Vote.target_type == target_type,
                               Vote.target_id == target_id).limit(1)
    )
    if existing.scalar_one_or_none() is not None:
        return
    await create_notification(db, recipient_id=target_author_id, actor_id=actor.id,
                               event_type="vote_cast", subject_type=target_type, subject_id=target_id,
                               link=f"/questions/{question_id}", coalesce_key=f"vote:{target_type}:{target_id}")


async def notify_content_edited(db, *, kind, obj, question_id, question_author_id, actor_id) -> None:
    grace = timedelta(seconds=settings.EDIT_NOTIFICATION_GRACE_SECONDS)
    if datetime.utcnow() - obj.created_at <= grace:
        return
    await create_notification(db, recipient_id=question_author_id, actor_id=actor_id,
                                event_type="content_edited", subject_type=kind, subject_id=obj.id,
                                link=f"/questions/{question_id}")
    
    