from typing import Literal

from pydantic import BaseModel, ConfigDict

from app.schemas.user import ProfileUpdateIn, UserMeOut


class AdminUserUpdateIn(ProfileUpdateIn):
    model_config = ConfigDict(extra="forbid")


class AdminRoleUpdateIn(BaseModel):
    model_config = ConfigDict(extra="forbid")

    role: Literal["user", "admin"]


class AdminUsersPage(BaseModel):
    items: list[UserMeOut]
    total: int
    page: int
    limit: int