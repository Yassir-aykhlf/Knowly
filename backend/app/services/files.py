import io
import logging
import uuid
from pathlib import Path

import magic
from fastapi import HTTPException
from PIL import Image, UnidentifiedImageError
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.answer import Answer
from app.models.attachment import Attachment
from app.models.question import Question
from app.services.content import can_view

logger = logging.getLogger("knowly.files")
PARENT_MODELS = {"question": Question, "answer": Answer}
EXTENSIONS = {
    "image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp",
    "image/gif": ".gif", "application/pdf": ".pdf",
    "text/plain": ".txt", "text/markdown": ".md",
}


def validation_error(message: str, field: str = "file") -> HTTPException:
    return HTTPException(400, detail={
        "code": "validation_error", "message": message, "fields": {field: message},
    })


def detect_mime(raw: bytes) -> str:
    if not raw:
        raise validation_error("File is empty")
    mime = magic.from_buffer(raw, mime=True)
    if mime not in EXTENSIONS:
        raise validation_error("Unsupported file type")
    if mime.startswith("image/"):
        try:
            with Image.open(io.BytesIO(raw)) as image:
                if Image.MIME.get(image.format) != mime:
                    raise validation_error("Invalid image content")
                image.verify()
        except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
            raise validation_error("Invalid image content") from None
    elif mime.startswith("text/"):
        try:
            decoded = raw.decode("utf-8-sig")
        except UnicodeDecodeError:
            raise validation_error("Text files must use UTF-8 encoding") from None
        if any(ord(char) < 32 and char not in "\t\n\r" for char in decoded):
            raise validation_error("Invalid text content")
    elif not raw.startswith(b"%PDF-"):
        raise validation_error("Invalid PDF content")
    return mime


def store_file(raw: bytes, mime: str) -> str:
    directory = Path(settings.UPLOAD_DIR)
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f"{uuid.uuid4().hex}{EXTENSIONS[mime]}"
    try:
        with path.open("xb") as stream:
            stream.write(raw)
    except OSError:
        delete_file(str(path))
        raise
    return str(path)


def delete_file(stored_path: str | None) -> None:
    if stored_path is None:
        return
    path = Path(stored_path)
    if not path.resolve().is_relative_to(Path(settings.UPLOAD_DIR).resolve()):
        logger.warning("Refusing to delete a file outside the upload directory")
        return
    try:
        path.unlink(missing_ok=True)
    except OSError:
        logger.warning("Could not remove an uploaded file")


async def can_read(db: AsyncSession, attachment, user) -> bool:
    if user is None:
        return False
    if user.role == "admin" or attachment.uploader_id == user.id:
        return True
    model = PARENT_MODELS.get(attachment.parent_type)
    if model is None or attachment.parent_id is None:
        return False
    parent = await db.get(model, attachment.parent_id)
    if parent is None or not can_view(parent, user):
        return False
    if isinstance(parent, Answer):
        question = await db.get(Question, parent.question_id)
        return question is not None and can_view(question, user)
    return True


async def load_owned_parent(db: AsyncSession, parent_type: str, parent_id, user):
    model = PARENT_MODELS.get(parent_type)
    if model is None:
        raise validation_error("Invalid parent type", "parent_type")
    parent = await db.scalar(select(model).where(model.id == parent_id).with_for_update())
    if parent is None:
        raise HTTPException(404, detail="Parent content not found")
    if parent.author_id != user.id:
        raise HTTPException(403, detail="Only the author can attach files to this content")
    return parent


async def bind_attachments(
    db: AsyncSession, *, attachment_ids: list, parent_type: str, parent_id: uuid.UUID, user
) -> list:
    if not attachment_ids:
        return []
    await load_owned_parent(db, parent_type, parent_id, user)
    try:
        ids = set(uuid.UUID(str(value)) for value in attachment_ids)
    except (ValueError, TypeError, AttributeError):
        raise validation_error("Invalid attachment id", "attachment_ids") from None
    rows = (await db.scalars(
        select(Attachment).where(Attachment.id.in_(ids))
        .order_by(Attachment.id).with_for_update()
    )).all()
    if len(rows) != len(ids):
        raise validation_error("Unknown attachment", "attachment_ids")
    for attachment in rows:
        if attachment.uploader_id != user.id:
            raise validation_error("Attachment belongs to another user", "attachment_ids")
        if (attachment.parent_type, attachment.parent_id) not in (
            (None, None), (parent_type, parent_id),
        ):
            raise validation_error("Attachment is already bound to another post", "attachment_ids")
    count = await db.scalar(select(func.count()).select_from(Attachment).where(
        Attachment.parent_type == parent_type, Attachment.parent_id == parent_id,
    ))
    additions = sum(attachment.parent_id is None for attachment in rows)
    if count + additions > 10:
        raise validation_error("At most 10 attachments are allowed per post", "attachment_ids")
    for attachment in rows:
        attachment.parent_type = parent_type
        attachment.parent_id = parent_id
    await db.flush()
    return list(rows)


async def attachments_for(db: AsyncSession, parent_type: str, parent_ids: list) -> dict:
    if not parent_ids:
        return {}
    rows = await db.scalars(select(Attachment).where(
        Attachment.parent_type == parent_type, Attachment.parent_id.in_(parent_ids),
    ).order_by(Attachment.created_at, Attachment.id))
    grouped = {}
    for attachment in rows:
        grouped.setdefault(attachment.parent_id, []).append(attachment)
    return grouped


async def delete_attachments_for(db: AsyncSession, parent_type: str, parent_ids: list) -> list:
    if not parent_ids:
        return []
    paths = await db.scalars(delete(Attachment).where(
        Attachment.parent_type == parent_type, Attachment.parent_id.in_(parent_ids),
    ).returning(Attachment.stored_path))
    return list(paths)
