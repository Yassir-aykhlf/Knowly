import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import AuthorOut
from app.schemas.answer import AnswerOut          # this are just excpected types
from app.schemas.comment import CommentOut        # well be defined in future PRs
from app.schemas.attachment import AttachmentOut


class QuestionCreateIn(BaseModel):
    title: str
    body: str
    tags: list[str] = Field(default_factory=list)
    attachment_ids: list[uuid.UUID] = Field(default_factory=list)


class QuestionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str
    body: str
    tags: list[str]
    author: AuthorOut
    view_count: int
    vote_total: int = 0
    my_vote: int = 0
    accepted_answer_id: uuid.UUID | None = None
    moderation_status: str
    moderation_note: str | None = None
    created_at: datetime
    updated_at: datetime
    answers: list[AnswerOut] = Field(default_factory=list)
    comments: list[CommentOut] = Field(default_factory=list)
    attachments: list[AttachmentOut] = Field(default_factory=list)
