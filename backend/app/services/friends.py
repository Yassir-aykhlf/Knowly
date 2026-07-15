import uuid

from sqlalchemy.ext.asyncio import AsyncSession


async def friendship_state_for(
    db: AsyncSession, caller, other_id: uuid.UUID
) -> tuple[str, uuid.UUID | None]:
    return "none", None