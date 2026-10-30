import uuid
from app.schemas.common import UtcDateTime

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
    last_seen: UtcDateTime | None
    since: UtcDateTime


class PendingRequestOut(BaseModel):
    friendship_id: uuid.UUID
    requester: AuthorOut
    created_at: UtcDateTime
