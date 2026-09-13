from datetime import datetime
import uuid

import re

from pydantic import BaseModel, EmailStr, Field, field_validator

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

class FriendshipOut(BaseModel):
    state: str
    id: uuid.UUID | None


class UserProfileOut(BaseModel):
    id: uuid.UUID
    username: str
    bio: str | None
    avatar_url: str | None
    created_at: datetime
    question_count: int
    answer_count: int
    accepted_answer_count: int
    is_anonymized: bool
    friendship: FriendshipOut | None

    @classmethod
    def from_user(
        cls,
        user: User,
        question_count: int,
        answer_count: int,
        accepted_answer_count: int,
        friendship: FriendshipOut | None,
    ) -> "UserProfileOut":
        return cls(
            id=user.id,
            username=user.username,
            bio=None if user.is_anonymized else user.bio,
            avatar_url=None if user.is_anonymized else user.avatar_path,
            created_at=user.created_at,
            question_count=question_count,
            answer_count=answer_count,
            accepted_answer_count=accepted_answer_count,
            is_anonymized=user.is_anonymized,
            friendship=friendship,
        )


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

class RegisterIn(BaseModel):
    email: EmailStr

    username: str = Field(
        min_length=3,
        max_length=30,
        pattern=r"^[A-Za-z0-9_-]+$",
    )

    password: str = Field(
        min_length=8,
        max_length=128,
    )

    @field_validator("password")
    @classmethod
    def _letter_and_digit(cls, v: str) -> str:
        has_letter = re.search(r"[A-Za-z]", v)
        has_digit = re.search(r"\d", v)

        if not has_letter or not has_digit:
            raise ValueError(
                "Password must contain at least one letter and one digit"
            )

        return v

   
class UserProfileUpdateIn(BaseModel):
    username: str | None = Field(
        default=None,
        min_length=3,
        max_length=30,
        pattern=r"^[A-Za-z0-9_-]+$",
    )
    bio: str | None = None

    @field_validator("username")
    @classmethod
    def _username_must_not_be_null(cls, value: str | None) -> str:
        if value is None:
            raise ValueError("Username cannot be null")
        return value

    @field_validator("bio", mode="before")
    @classmethod
    def _normalize_bio(cls, value: str | None) -> str | None:
        if value is None:
            return None

        value = value.strip()

        if len(value) > 500:
            raise ValueError("Bio must be 500 characters or fewer")

        return value or None

class PasswordChangeIn(BaseModel):
    current_password: str

    new_password: str = Field(
        min_length=8,
        max_length=128,
    )

    @field_validator("new_password")
    @classmethod
    def _letter_and_digit(cls, v: str) -> str:
        has_letter = re.search(r"[A-Za-z]", v)
        has_digit = re.search(r"\d", v)

        if not has_letter or not has_digit:
            raise ValueError(
                "Password must contain at least one letter and one digit"
            )

        return v