
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


class FriendshipStateOut(BaseModel):
    state: str
    id: uuid.UUID | None


class UserProfileOut(BaseModel):
    id: uuid.UUID
    username: str
    bio: str | None
    avatar_url: str | None
    created_at: datetime
    is_anonymized: bool

    question_count: int
    answer_count: int
    accepted_answer_count: int

    friendship: FriendshipStateOut | None


class AuthorOut(BaseModel):
    id: uuid.UUID
    username: str
    avatar_url: str | None
    is_anonymized: bool


class ProfileQuestionOut(BaseModel):
    id: uuid.UUID
    title: str
    excerpt: str
    tags: list[str]
    author: AuthorOut
    vote_total: int
    answer_count: int
    view_count: int
    has_accepted_answer: bool
    created_at: datetime


class ProfileQuestionPage(BaseModel):
    items: list[ProfileQuestionOut]
    total: int
    page: int
    limit: int


class ProfileAnswerOut(BaseModel):
    id: uuid.UUID
    question_id: uuid.UUID
    question_title: str
    excerpt: str
    vote_total: int
    is_accepted: bool
    created_at: datetime


class ProfileAnswerPage(BaseModel):
    items: list[ProfileAnswerOut]
    total: int
    page: int
    limit: int


class ProfileUpdateIn(BaseModel):
    username: str | None = Field(
        default=None,
        min_length=3,
        max_length=30,
        pattern=r"^[A-Za-z0-9_-]+$",
    )

    bio: str | None = Field(
        default=None,
        max_length=500,
    )

    @field_validator("username")
    @classmethod
    def reject_null_username(cls, value: str | None) -> str:
        if value is None:
            raise ValueError("Username cannot be null")

        return value

    @field_validator("bio", mode="before")
    @classmethod
    def normalize_bio(cls, value: str | None) -> str | None:
        if isinstance(value, str):
            return value.strip() or None

        return value
