import uuid
from pydantic import BaseModel, ConfigDict

from app.schemas.user import AuthorOut


class CommentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    parent_type: str
    parent_id: uuid.UUID
    body: str
    author: AuthorOut
    moderation_status: str
    moderation_note: str | None = None
    created_at: str
    updated_at: str
