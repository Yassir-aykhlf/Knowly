import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict, field_validator

from app.schemas.user import AuthorOut


class MessageCreate(BaseModel):
    body: str

    @field_validator("body")
    @classmethod
    def trim_and_check_length(cls, value: str) -> str:
        trimmed = value.strip()
        if not (1 <= len(trimmed) <= 4000):
            raise ValueError("body must be between 1 and 4000 characters")
        return trimmed


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    sender_id: uuid.UUID
    receiver_id: uuid.UUID
    body: str
    read_at: datetime | None
    created_at: datetime


class MessagePage(BaseModel):
    items: list[MessageOut]
    total: int
    page: int
    limit: int


class ConversationOut(BaseModel):
    user: AuthorOut
    last_message: str
    last_message_at: datetime
    last_message_from_me: bool
    unread_count: int