import uuid
from typing import Literal

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User

from app.schemas.admin_users import (
    AdminRoleUpdateIn,
    AdminUserUpdateIn,
    AdminUsersPage,
)

from app.schemas.user import UserMeOut

from app.services.auth import require_admin

from app.services.admin_users import (
    list_admin_users,
    get_admin_target,
    admin_update_user,
    admin_update_role,
    admin_delete_user,
)


router = APIRouter(
    prefix="/admin/users",
    tags=["admin-users"],
)


@router.get(
    "",
    response_model=AdminUsersPage,
)
async def list_users(
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
    q: str | None = Query(default=None, max_length=254),
    role: Literal["user", "admin"] | None = Query(
        default=None
    ),
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> AdminUsersPage:

    return await list_admin_users(
        db=db,
        page=page,
        limit=limit,
        q=q,
        role=role,
    )


@router.get(
    "/{target_id}",
    response_model=UserMeOut,
)
async def get_user(
    target_id: uuid.UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserMeOut:

    target = await get_admin_target(
        db,
        target_id,
    )

    return UserMeOut.from_user(target)


@router.patch(
    "/{target_id}",
    response_model=UserMeOut,
)
async def update_user(
    target_id: uuid.UUID,
    data: AdminUserUpdateIn,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserMeOut:

    target = await admin_update_user(
        db,
        admin,
        target_id,
        data,
    )

    return UserMeOut.from_user(target)


@router.patch(
    "/{target_id}/role",
    response_model=UserMeOut,
)
async def update_role(
    target_id: uuid.UUID,
    data: AdminRoleUpdateIn,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> UserMeOut:

    target = await admin_update_role(
        db,
        admin,
        target_id,
        data,
    )

    return UserMeOut.from_user(target)


@router.delete(
    "/{target_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_user(
    target_id: uuid.UUID,
    admin: User = Depends(require_admin),
    db: AsyncSession = Depends(get_db),
) -> None:

    await admin_delete_user(
        db,
        admin,
        target_id,
    )