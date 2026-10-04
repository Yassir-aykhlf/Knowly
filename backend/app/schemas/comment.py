import uuid
from pydantic import BaseModel, ConfigDict
from typing import TYPE_CHECKING

from app.schemas.user import AuthorOut


if TYPE_CHECKING:
    from app.models import Answer, Comment


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
    def from_comment(cls, comment: "Comment") -> "CommentOut":
        return cls(
            id=str(comment.id),                           # UUID -> str
            parent_type=comment.parent_type,
            # schema wants uuid.UUID, so no str()
            parent_id=comment.parent_id,
            body=comment.body,
            author=AuthorOut.from_user(
                comment.author),   # must be eager-loaded
            moderation_status=comment.moderation_status,
            moderation_note=comment.moderation_note,
            created_at=comment.created_at.isoformat(),
            updated_at=comment.updated_at.isoformat(),
        )
