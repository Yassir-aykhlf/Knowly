import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class ConversationCreate(BaseModel):
    question_id: uuid.UUID | None = None


class QuestionContext(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    title: str


class ConversationOut(BaseModel):
    id: uuid.UUID
    title: str | None
    question: QuestionContext | None
    created_at: datetime
    updated_at: datetime


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime


class ConversationDetail(ConversationOut):
    messages: list[MessageOut]
