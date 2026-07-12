from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User

async def promote_to_admin(db: AsyncSession, email: str) -> User | None:
    return None

async def bootstrap_initial_admin(db: AsyncSession) -> None:
    return None