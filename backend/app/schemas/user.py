import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator
from app.models.user import User 

class UserMeOut(BaseModel):
    id: uuid.UUID
    email: EmailStr | None
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


class UserPublicOut(BaseModel):
    id: uuid.UUID
    username: str
    bio: str | None
    avatar_url : str | None
    created_at : datetime
    question_count: int
    answer_count : int 
    accepted_answer_count : int 
    is_anonymized : bool
    friendship : bool 

    @classmethod
    def from_user(cls, user: User) -> "UserPublicOut":
        return cls(
            id= user.id,
            username = user.username,
            bio = user.bio,
            avatar_url = user.avatar_path,
            created_at = user.created_at,
            question_cout = 
        )


