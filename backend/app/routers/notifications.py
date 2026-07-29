import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.notification import Notification
from app.models.user import User
from app.schemas.notification import NotificationOut, NotificationPage
from app.schemas.user import AuthorOut
from app.services.auth import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationPage)
async def list_notifications(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> NotificationPage:
    base_filter = Notification.recipient_id == user.id

    total_result = await db.execute(
        select(func.count()).select_from(Notification).where(base_filter)
    )
    total = total_result.scalar_one()

    rows_result = await db.execute(
        select(Notification)
        .where(base_filter)
        .order_by(Notification.created_at.desc(), Notification.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    rows = rows_result.scalars().all()

    actor_ids = {row.actor_id for row in rows if row.actor_id is not None}
    actors_by_id: dict[uuid.UUID, User] = {}
    if actor_ids:
        actors_result = await db.execute(select(User).where(User.id.in_(actor_ids)))
        actors_by_id = {u.id: u for u in actors_result.scalars().all()}

    items = []
    for row in rows:
        actor_model = actors_by_id.get(row.actor_id) if row.actor_id else None
        actor_out = (
            AuthorOut.from_user(actor_model)
            if actor_model is not None and not actor_model.is_anonymized
            else None
        )
        items.append(
            NotificationOut(
                id=row.id,
                event_type=row.event_type,
                subject_type=row.subject_type,
                subject_id=row.subject_id,
                link=row.link,
                actor=actor_out,
                actor_count=row.actor_count,
                read_at=row.read_at,
                created_at=row.created_at,
            )
        )

    return NotificationPage(items=items, total=total, page=page, limit=limit)


@router.get("/unread-count")
async def unread_count(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    result = await db.execute(
        select(func.count()).select_from(Notification).where(
            Notification.recipient_id == user.id,
            Notification.read_at.is_(None),
        )
    )
    return {"count": result.scalar_one()}


@router.put("/{notification_id}/read", status_code=204)
async def mark_read(
    notification_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    result = await db.execute(
        select(Notification).where(
            Notification.id == notification_id,
            Notification.recipient_id == user.id,
        )
    )
    notification = result.scalar_one_or_none()
    if notification is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "Notification not found"},
        )

    if notification.read_at is None:
        notification.read_at = datetime.utcnow()
        await db.commit()

    return None


@router.put("/read-all", status_code=204)
async def mark_all_read(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await db.execute(
        update(Notification)
        .where(Notification.recipient_id == user.id, Notification.read_at.is_(None))
        .values(read_at=datetime.utcnow())
    )
    await db.commit()

    return None