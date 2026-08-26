import uuid
from datetime import datetime

from fastapi import HTTPException
from sqlalchemy import and_, func, or_, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.message import Message
from app.models.user import User
from app.schemas.message import ConversationOut
from app.schemas.user import AuthorOut

PREVIEW_LEN = 100


async def send_message(
    db: AsyncSession, sender_id: uuid.UUID, receiver_id: uuid.UUID, body: str
) -> Message:
    if sender_id == receiver_id:
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_request", "message": "You cannot message yourself"},
        )

    receiver = await db.get(User, receiver_id)
    if receiver is None or receiver.is_anonymized:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "User not found"},
        )

    message = Message(sender_id=sender_id, receiver_id=receiver_id, body=body)
    db.add(message)
    await db.commit()
    await db.refresh(message)
    return message


async def get_conversation_history(
    db: AsyncSession,
    caller_id: uuid.UUID,
    other_id: uuid.UUID,
    page: int,
    limit: int,
) -> tuple[list[Message], int]:
    base_filter = or_(
        and_(Message.sender_id == caller_id, Message.receiver_id == other_id),
        and_(Message.sender_id == other_id, Message.receiver_id == caller_id),
    )

    total_result = await db.execute(select(func.count()).select_from(Message).where(base_filter))
    total = total_result.scalar_one()

    rows_result = await db.execute(
        select(Message)
        .where(base_filter)
        .order_by(Message.created_at.desc(), Message.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    rows = rows_result.scalars().all()
    return rows, total


async def mark_conversation_read(db: AsyncSession, caller_id: uuid.UUID, other_id: uuid.UUID) -> None:
    result = await db.execute(
        update(Message)
        .where(
            Message.sender_id == other_id,
            Message.receiver_id == caller_id,
            Message.read_at.is_(None),
        )
        .values(read_at=datetime.utcnow())
    )
    if result.rowcount:
        await db.commit()
    else:
        await db.rollback()


async def list_conversations(db: AsyncSession, caller_id: uuid.UUID) -> list[ConversationOut]:
    result = await db.execute(
        select(Message)
        .where(or_(Message.sender_id == caller_id, Message.receiver_id == caller_id))
        .order_by(Message.created_at.desc(), Message.id.desc())
    )
    rows = result.scalars().all()

    latest_by_correspondent: dict[uuid.UUID, Message] = {}
    unread_counts: dict[uuid.UUID, int] = {}

    for row in rows:
        correspondent_id = row.receiver_id if row.sender_id == caller_id else row.sender_id

        if correspondent_id not in latest_by_correspondent:
            latest_by_correspondent[correspondent_id] = row

        if row.receiver_id == caller_id and row.read_at is None:
            unread_counts[correspondent_id] = unread_counts.get(correspondent_id, 0) + 1

    if not latest_by_correspondent:
        return []

    users_result = await db.execute(
        select(User).where(User.id.in_(latest_by_correspondent.keys()))
    )
    users_by_id = {u.id: u for u in users_result.scalars().all()}

    conversations = []
    for correspondent_id, latest in latest_by_correspondent.items():
        correspondent = users_by_id.get(correspondent_id)
        if correspondent is None:
            continue
        preview = latest.body if len(latest.body) <= PREVIEW_LEN else latest.body[:PREVIEW_LEN]
        conversations.append(
            ConversationOut(
                user=AuthorOut.from_user(correspondent),
                last_message=preview,
                last_message_at=latest.created_at,
                last_message_from_me=latest.sender_id == caller_id,
                unread_count=unread_counts.get(correspondent_id, 0),
            )
        )

    return conversations