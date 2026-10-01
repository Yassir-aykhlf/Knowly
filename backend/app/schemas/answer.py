from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import AuthorOut
from app.schemas.comment import CommentOut
from app.schemas.attachment import AttachmentOut


class AnswerOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    body: str
    author: AuthorOut
    is_ai_assisted: bool
    vote_total: int
    my_vote: int
    moderation_status: str
    moderation_note: str | None = None
    created_at: str
    updated_at: str
    comments: list[CommentOut] = Field(default_factory=list)
    attachments: list[AttachmentOut] = Field(default_factory=list)
