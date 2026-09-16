import uuid

from pydantic import BaseModel, ConfigDict


class FriendRequestCreate(BaseModel):
    addressee_id: uuid.UUID


class FriendRequestOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    status: str