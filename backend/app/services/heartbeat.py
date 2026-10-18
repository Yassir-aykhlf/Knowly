from datetime import datetime, timedelta

from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


async def update_last_seen(
    db: AsyncSession,
    user_id,
) -> None:
    now = datetime.utcnow()
    cutoff = now - timedelta(seconds=30)

    await db.execute(
        update(User)
        .where(
            User.id == user_id,
            User.last_seen < cutoff,
        )
        .values(last_seen=now)
    )

    await db.commit()