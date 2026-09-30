import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import AuthorOut
from app.models.answer import Answer
from app.models.comment import Comment
from app.models.attachment import Attachment


class QuestionCreateIn(BaseModel):
    title: str = ""
    body: str = ""
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
    answers: list[Answer] = Field(default_factory=list)
    comments: list[Comment] = Field(default_factory=list)
    attachments: list[Attachment] = Field(default_factory=list)
    # attachments: list[AttachmentOut] = Field(default_factory=list)
