import uuid
from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, StringConstraints

from app.schemas.user import AuthorOut

ContentType = Literal['question', 'answer', 'comment']


class PendingModerationItem(BaseModel):
    type: ContentType
    id: uuid.UUID
    title: str | None
    body: str
    author: AuthorOut
    moderation_note: str | None
    question_id: uuid.UUID | None
    created_at: datetime


class RejectIn(BaseModel):
    note: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]


class ModerationVerdict(BaseModel):
    type: ContentType
    id: uuid.UUID
    moderation_status: Literal['approved', 'rejected']
