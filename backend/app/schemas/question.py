from pydantic import BaseModel, Field, ConfigDict
from datetime import datetime
from typing import Any
import uuid


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
    author: Any
    view_count: int
    vote_total: int = 0
    my_vote: int = 0
    accepted_answer_id: uuid.UUID | None = None
    moderation_status: str
    moderation_note: str | None = None
    created_at: datetime
    updated_at: datetime
    answers: list[Any] = []
    comments: list[Any] = []
    attachments: list[Any] = []
