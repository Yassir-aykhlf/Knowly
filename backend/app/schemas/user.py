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