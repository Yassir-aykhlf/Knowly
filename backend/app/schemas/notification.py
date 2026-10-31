import uuid
from app.schemas.common import UtcDateTime

from pydantic import BaseModel

from app.schemas.user import AuthorOut


class NotificationOut(BaseModel):
    id: uuid.UUID
    event_type: str
    subject_type: str | None
    subject_id: uuid.UUID | None
    link: str
    actor: AuthorOut | None
    actor_count: int
    read_at: UtcDateTime | None
    created_at: UtcDateTime


class NotificationPage(BaseModel):
    items: list[NotificationOut]
    total: int
    page: int
    limit: int