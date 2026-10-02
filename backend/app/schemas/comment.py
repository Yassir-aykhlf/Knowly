import uuid
from typing import Literal

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

    @classmethod
    def from_comment(cls, comment) -> "CommentOut":
        return cls(
            id=str(comment.id),
            parent_type=comment.parent_type,
            parent_id=comment.parent_id,
            body=comment.body,
            author=AuthorOut.from_user(comment.author),
            moderation_status=comment.moderation_status,
            moderation_note=comment.moderation_note,
            created_at=comment.created_at.isoformat(),
            updated_at=comment.updated_at.isoformat(),
        )


class CommentCreate(BaseModel):
    parent_type: Literal["question", "answer"]
    parent_id: uuid.UUID
    body: str


class CommentUpdate(BaseModel):
    body: str
