import uuid

from sqlalchemy.ext.asyncio import AsyncSession


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
    return None


async def emit_content_approved(
    db: AsyncSession, *, kind: str, obj, question_id: uuid.UUID, parent_author_id=None
) -> None:
    return None


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
    return None


async def notify_content_edited(
    db: AsyncSession, *, kind: str, obj, question_id, question_author_id, actor_id
) -> None:
    return None