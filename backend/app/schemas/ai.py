import uuid
from typing import Literal
from app.schemas.common import UtcDateTime

from pydantic import BaseModel, ConfigDict, Field, field_validator


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
    created_at: UtcDateTime
    updated_at: UtcDateTime


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    role: Literal["user", "assistant"]
    content: str
    created_at: UtcDateTime


class ConversationDetail(ConversationOut):
    messages: list[MessageOut]


class MessageCreate(BaseModel):
    content: str = Field(max_length=8000)

    @field_validator("content", mode="before")
    @classmethod
    def clean_content(cls, value: str) -> str:
        if not isinstance(value, str):
            return value
        value = value.strip()
        if not value:
            raise ValueError("Message must not be empty")
        return value
