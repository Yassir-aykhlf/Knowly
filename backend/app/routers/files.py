import uuid
from pathlib import Path

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.session import get_db
from app.models.attachment import Attachment
from app.models.user import User
from app.schemas.attachment import AttachmentOut
from app.services import files
from app.services.auth import get_current_user

router = APIRouter(prefix="/files", tags=["files"])


@router.post("", response_model=AttachmentOut, status_code=201)
async def upload_file(
    file: UploadFile = File(...),
    parent_type: str | None = Form(None),
    parent_id: uuid.UUID | None = Form(None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if (parent_type is None) != (parent_id is None):
        raise files.validation_error("Parent type and id must be supplied together", "parent_id")
    if parent_type is not None:
        await files.load_owned_parent(db, parent_type, parent_id, user)
    try:
        raw = await file.read(settings.UPLOAD_MAX_BYTES + 1)
    finally:
        await file.close()
    if len(raw) > settings.UPLOAD_MAX_BYTES:
        raise files.validation_error("File exceeds the upload size limit")
    mime = files.detect_mime(raw)
    path = files.store_file(raw, mime)
    try:
        attachment = Attachment(
            uploader_id=user.id, original_filename=file.filename or "download",
            stored_path=path, mime_type=mime, size_bytes=len(raw),
        )
        db.add(attachment)
        await db.flush()
        if parent_type is not None:
            await files.bind_attachments(
                db, attachment_ids=[attachment.id], parent_type=parent_type,
                parent_id=parent_id, user=user,
            )
        result = AttachmentOut.from_attachment(attachment)
        await db.commit()
        return result
    except BaseException:
        files.delete_file(path)
        raise


@router.get("/{attachment_id}")
async def read_file(
    attachment_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    attachment = await db.get(Attachment, attachment_id)
    if attachment is None or not await files.can_read(db, attachment, user):
        raise HTTPException(404, detail="File not found")
    path = Path(attachment.stored_path)
    if not path.resolve().is_relative_to(Path(settings.UPLOAD_DIR).resolve()) or not path.is_file():
        raise HTTPException(404, detail="File not found")
    return FileResponse(
        path, media_type=attachment.mime_type, filename=attachment.original_filename,
        content_disposition_type="inline" if attachment.mime_type.startswith("image/") else "attachment",
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )


@router.delete("/{attachment_id}", status_code=204)
async def remove_file(
    attachment_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    attachment = await db.scalar(select(Attachment).where(
        Attachment.id == attachment_id,
    ).with_for_update())
    if attachment is None:
        raise HTTPException(404, detail="File not found")
    if attachment.uploader_id != user.id:
        raise HTTPException(403, detail="Only the uploader can delete this file")
    path = attachment.stored_path
    await db.delete(attachment)
    await db.commit()
    files.delete_file(path)
    return Response(status_code=204)
