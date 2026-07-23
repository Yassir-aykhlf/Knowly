from datetime import datetime
import uuid

from pydantic import BaseModel

from app.models.user import User


class AuthorOut(BaseModel):
    id: uuid.UUID
    username: str
    avatar_url: str | None
    is_anonymized: bool

    @classmethod
    def from_user(cls, user: User) -> "AuthorOut":
        return cls(
            id=user.id,
            username=user.username,
            avatar_url=user.avatar_path,
            is_anonymized=user.is_anonymized,
        )


class UserMeOut(BaseModel):
    id: uuid.UUID
    email: str | None
    username: str
    bio: str | None
    avatar_url: str | None
    role: str
    created_at: datetime
    is_anonymized: bool
    has_password: bool

    @classmethod
    def from_user(cls, user: User) -> "UserMeOut":
        return cls(
            id=user.id,
            email=user.email,
            username=user.username,
            bio=user.bio,
            avatar_url=user.avatar_path,
            role=user.role,
            created_at=user.created_at,
            is_anonymized=user.is_anonymized,
            has_password=user.password_hash is not None,
        )