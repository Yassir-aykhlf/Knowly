import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from app.schemas.user import AuthorOut


class FriendRequestCreate(BaseModel):
    addressee_id: uuid.UUID


class FriendRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: str


class FriendOut(BaseModel):
    friendship_id: uuid.UUID
    user: AuthorOut
    online: bool
    last_seen: datetime | None
    since: datetime


class PendingRequestOut(BaseModel):
    friendship_id: uuid.UUID
    requester: AuthorOut
    created_at: datetime