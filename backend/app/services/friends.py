import uuid
from datetime import datetime, timedelta

from fastapi import HTTPException
from sqlalchemy import and_, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.friendship import Friendship
from app.models.user import User
from app.schemas.user import AuthorOut
from app.services.notifications import create_notification


async def friendship_state_for(
    db: AsyncSession, viewer: User, other_id: uuid.UUID
) -> tuple[str, uuid.UUID | None]:
    friendship = await _find_pair(db, viewer.id, other_id)
    if friendship is None:
        return "none", None

    if friendship.status == "accepted":
        return "friends", friendship.id
    if friendship.status == "rejected":
        return "rejected", friendship.id

    # status == "pending"
    if friendship.requester_id == viewer.id:
        return "request_sent", friendship.id
    return "incoming_pending", friendship.id


ONLINE_WINDOW = timedelta(minutes=2)


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


async def list_friends(db: AsyncSession, caller_id: uuid.UUID) -> list[dict]:
    stmt = select(Friendship).where(
        Friendship.status == "accepted",
        or_(Friendship.requester_id == caller_id, Friendship.addressee_id == caller_id),
    )
    result = await db.execute(stmt)
    friendships = result.scalars().all()

    other_ids = [
        f.addressee_id if f.requester_id == caller_id else f.requester_id
        for f in friendships
    ]
    if not other_ids:
        return []

    users_result = await db.execute(select(User).where(User.id.in_(other_ids)))
    users_by_id = {u.id: u for u in users_result.scalars().all()}

    now = datetime.utcnow()
    entries = []
    for f in friendships:
        other_id = f.addressee_id if f.requester_id == caller_id else f.requester_id
        other = users_by_id.get(other_id)
        if other is None:
            continue
        online = other.last_seen is not None and (now - other.last_seen) < ONLINE_WINDOW
        entries.append(
            {
                "friendship_id": f.id,
                "user": AuthorOut.from_user(other),
                "online": online,
                "last_seen": other.last_seen,
                "since": f.created_at,
            }
        )

    entries.sort(key=lambda e: e["user"].username.lower())
    return entries


async def list_pending_requests(db: AsyncSession, caller_id: uuid.UUID) -> list[dict]:
    stmt = (
        select(Friendship)
        .where(Friendship.status == "pending", Friendship.addressee_id == caller_id)
        .order_by(Friendship.created_at.desc())
    )
    result = await db.execute(stmt)
    friendships = result.scalars().all()

    requester_ids = [f.requester_id for f in friendships]
    if not requester_ids:
        return []

    users_result = await db.execute(select(User).where(User.id.in_(requester_ids)))
    users_by_id = {u.id: u for u in users_result.scalars().all()}

    entries = []
    for f in friendships:
        requester = users_by_id.get(f.requester_id)
        if requester is None:
            continue
        entries.append(
            {
                "friendship_id": f.id,
                "requester": AuthorOut.from_user(requester),
                "created_at": f.created_at,
            }
        )
    return entries


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


async def _get_friendship_or_404(db: AsyncSession, friendship_id: uuid.UUID) -> Friendship:
    friendship = await db.get(Friendship, friendship_id)
    if friendship is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "Friendship not found"},
        )
    return friendship


async def _respond_to_request(
    db: AsyncSession,
    friendship_id: uuid.UUID,
    caller_id: uuid.UUID,
    new_status: str,
) -> Friendship:
    friendship = await _get_friendship_or_404(db, friendship_id)

    if caller_id != friendship.addressee_id:
        raise HTTPException(
            status_code=403,
            detail={"code": "forbidden", "message": "Only the addressee can respond to this request"},
        )

    if friendship.status != "pending":
        raise HTTPException(
            status_code=409,
            detail={"code": "conflict", "message": "This request is no longer pending"},
        )

    friendship.status = new_status

    if new_status == "accepted":
        await create_notification(
            db,
            recipient_id=friendship.requester_id,
            actor_id=caller_id,
            event_type="friend_accepted",
            link=f"/users/{caller_id}",
        )
    # reject is deliberately silent: no notification.

    await db.commit()
    await db.refresh(friendship)
    return friendship


async def accept_friend_request(
    db: AsyncSession, friendship_id: uuid.UUID, caller_id: uuid.UUID
) -> Friendship:
    return await _respond_to_request(db, friendship_id, caller_id, "accepted")


async def reject_friend_request(
    db: AsyncSession, friendship_id: uuid.UUID, caller_id: uuid.UUID
) -> Friendship:
    return await _respond_to_request(db, friendship_id, caller_id, "rejected")


async def remove_friendship(
    db: AsyncSession, friendship_id: uuid.UUID, caller_id: uuid.UUID
) -> None:
    friendship = await _get_friendship_or_404(db, friendship_id)

    if caller_id not in (friendship.requester_id, friendship.addressee_id):
        raise HTTPException(
            status_code=403,
            detail={"code": "forbidden", "message": "You are not part of this friendship"},
        )

    other_id = (
        friendship.addressee_id
        if caller_id == friendship.requester_id
        else friendship.requester_id
    )

    await create_notification(
        db,
        recipient_id=other_id,
        actor_id=caller_id,
        event_type="friend_removed",
        link=f"/users/{caller_id}",
    )
    await db.delete(friendship)
    await db.commit()