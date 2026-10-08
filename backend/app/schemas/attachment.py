import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, model_validator


class AttachmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    original_filename: str
    mime_type: str
    size_bytes: int
    url: str
    parent_type: str | None = None
    parent_id: str | None = None
    created_at: str

    @model_validator(mode="before")
    @classmethod
    def serialize_attachment(cls, value):
        if not isinstance(value, dict) and hasattr(value, "stored_path"):
            return cls.from_attachment(value).model_dump()
        return value

    @classmethod
    def from_attachment(cls, attachment) -> "AttachmentOut":
        return cls(
            id=str(attachment.id), original_filename=attachment.original_filename,
            mime_type=attachment.mime_type, size_bytes=attachment.size_bytes,
            url=f"/api/files/{attachment.id}", parent_type=attachment.parent_type,
            parent_id=str(attachment.parent_id) if attachment.parent_id is not None else None,
            created_at=attachment.created_at.isoformat(),
        )
