import uuid

from sqlalchemy.ext.asyncio import AsyncSession


def detect_mime(raw: bytes) -> str:
    raise NotImplementedError("detect_mime is a stub — implement in task D-09")


def store_file(raw: bytes, mime: str) -> str:
    raise NotImplementedError("store_file is a stub — implement in task D-09")


def delete_file(stored_path: str | None) -> None:
    return None

async def can_read(db: AsyncSession, attachment, user) -> bool:
    return user.role == "admin" or attachment.uploader_id == user.id


async def bind_attachments(
    db: AsyncSession, *, attachment_ids: list, parent_type: str, parent_id: uuid.UUID, user
) -> list:
    return []


async def attachments_for(db: AsyncSession, parent_type: str, parent_ids: list) -> dict:
    return {}


async def delete_attachments_for(db: AsyncSession, parent_type: str, parent_ids: list) -> list:
    return []