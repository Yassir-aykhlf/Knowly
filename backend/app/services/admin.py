from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.user import User


def is_initial_admin(email: str | None) -> bool:
    configured = settings.INITIAL_ADMIN_EMAIL.strip().lower()
    return bool(configured and email and email.strip().lower() == configured)


async def promote_to_admin(db: AsyncSession, email: str) -> User | None:
    normalized = email.strip().lower()
    if not normalized:
        return None
    user = (await db.execute(select(User).where(func.lower(User.email) == normalized))).scalar_one_or_none()
    if user is not None and user.role != "admin":
        user.role = "admin"
        await db.flush()
    return user


async def bootstrap_initial_admin(db: AsyncSession) -> None:
    email = settings.INITIAL_ADMIN_EMAIL.strip()
    if email:
        await promote_to_admin(db, email)
