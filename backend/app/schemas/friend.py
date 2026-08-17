import uuid

from pydantic import BaseModel


class FriendRequestCreate(BaseModel):
    addressee_id: uuid.UUID


class FriendRequestOut(BaseModel):
    id: uuid.UUID
    status: str

    class Config:
        from_attributes = True