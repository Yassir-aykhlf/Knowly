import uuid
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import and_, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.friendship import Friendship
from app.models.user import User
from app.services.notifications import create_notification


async def friendship_state_for(
    db: AsyncSession, caller, other_id: uuid.UUID
) -> tuple[str, uuid.UUID | None]:
    return "none", None


async def _find_pair(
    db: AsyncSession, a: uuid.UUID, b: uuid.UUID
) -> Friendship | None:
    stmt = select(Friendship).where(
        or_(
            and_(Friendship.requester_id == a, Friendship.addressee_id == b),
            and_(Friendship.requester_id == b, Friendship.addressee_id == a),
        )
    )
    result = await db.execute(stmt)
    return result.scalar_one_or_none()


async def send_friend_request(
    db: AsyncSession, caller_id: uuid.UUID, addressee_id: uuid.UUID
) -> Friendship:
    if caller_id == addressee_id:
        raise HTTPException(
            status_code=400,
            detail={"code": "invalid_request", "message": "You cannot friend yourself"},
        )

    addressee = await db.get(User, addressee_id)
    if addressee is None or addressee.is_anonymized:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "User not found"},
        )

    existing = await _find_pair(db, caller_id, addressee_id)

    if existing is not None:
        if existing.status in ("pending", "accepted"):
            raise HTTPException(
                status_code=409,
                detail={"code": "conflict", "message": "A friend request already exists"},
            )

        # existing.status == "rejected" -> re-request
        cooldown_hours = settings.FRIEND_REREQUEST_COOLDOWN_HOURS
        if cooldown_hours > 0:
            elapsed = datetime.utcnow() - existing.updated_at
            if elapsed < timedelta(hours=cooldown_hours):
                raise HTTPException(
                    status_code=429,
                    detail={"code": "rate_limited", "message": "Please wait before re-requesting"},
                )

        existing.status = "pending"
        existing.requester_id = caller_id
        existing.addressee_id = addressee_id
        await create_notification(
            db,
            recipient_id=addressee_id,
            actor_id=caller_id,
            event_type="friend_request",
            link=f"/users/{caller_id}",
        )
        await db.commit()
        await db.refresh(existing)
        return existing

    friendship = Friendship(
        requester_id=caller_id, addressee_id=addressee_id, status="pending"
    )
    db.add(friendship)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        # Lost the race for the unordered-pair unique index: fall through to
        # the "row already exists" logic using the row that won.
        existing = await _find_pair(db, caller_id, addressee_id)
        if existing is None:
            # Extremely unlikely, but don't loop forever.
            raise HTTPException(
                status_code=409,
                detail={"code": "conflict", "message": "A friend request already exists"},
            )
        if existing.status == "rejected":
            return await send_friend_request(db, caller_id, addressee_id)
        raise HTTPException(
            status_code=409,
            detail={"code": "conflict", "message": "A friend request already exists"},
        )

    await create_notification(
        db,
        recipient_id=addressee_id,
        actor_id=caller_id,
        event_type="friend_request",
        link=f"/users/{caller_id}",
    )
    await db.commit()
    await db.refresh(friendship)
    return friendship