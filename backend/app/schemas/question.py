import uuid
from app.schemas.common import UtcDateTime

from pydantic import BaseModel, ConfigDict, Field

from app.schemas.user import AuthorOut, ProfileQuestionOut
from app.schemas.answer import AnswerOut
from app.schemas.comment import CommentOut
from app.schemas.attachment import AttachmentOut


QuestionListItem = ProfileQuestionOut


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
    created_at: UtcDateTime
    updated_at: UtcDateTime
    answers: list[AnswerOut] = Field(default_factory=list)
    comments: list[CommentOut] = Field(default_factory=list)
    attachments: list[AttachmentOut] = Field(default_factory=list)


class QuestionPage(BaseModel):
    items: list[QuestionListItem]
    total: int
    page: int
    limit: int


class AcceptAnswerIn(BaseModel):
    answer_id: uuid.UUID | None


class AcceptAnswerOut(BaseModel):
    accepted_answer_id: uuid.UUID | None
