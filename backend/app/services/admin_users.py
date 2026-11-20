import uuid

from fastapi import HTTPException
from sqlalchemy import delete, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.session import Session
from app.models.user import User

from app.schemas.admin_users import (
    AdminRoleUpdateIn,
    AdminUserUpdateIn,
    AdminUsersPage,
)

from app.schemas.user import UserMeOut

from app.services.account import (
    anonymize_account,
    ensure_admin_removable,
    lock_admin_management,
)

from app.services.user import update_user_profile


async def list_admin_users(
    db: AsyncSession,
    page: int,
    limit: int,
    q: str | None = None,
    role: str | None = None,
) -> AdminUsersPage:

    conditions = [
        User.is_anonymized.is_(False)
    ]

    if q and q.strip():
        escaped = (
            q.strip()
            .replace("\\", "\\\\")
            .replace("%", "\\%")
            .replace("_", "\\_")
        )

        pattern = f"%{escaped}%"

        conditions.append(
            or_(
                User.username.ilike(
                    pattern,
                    escape="\\",
                ),
                User.email.ilike(
                    pattern,
                    escape="\\",
                ),
            )
        )

    if role is not None:
        conditions.append(User.role == role)

    count_stmt = (
        select(func.count())
        .select_from(User)
        .where(*conditions)
    )

    total = (
        await db.execute(count_stmt)
    ).scalar_one()

    stmt = (
        select(User)
        .where(*conditions)
        .order_by(User.username, User.id)
        .offset((page - 1) * limit)
        .limit(limit)
    )

    users = (
        await db.execute(stmt)
    ).scalars().all()

    return AdminUsersPage(
        items=[
            UserMeOut.from_user(user)
            for user in users
        ],
        total=total,
        page=page,
        limit=limit,
    )


async def get_admin_target(
    db: AsyncSession,
    target_id: uuid.UUID,
    lock: bool = False,
) -> User:

    stmt = select(User).where(
        User.id == target_id
    )

    if lock:
        stmt = (
            stmt.with_for_update()
            .execution_options(populate_existing=True)
        )

    target = (
        await db.execute(stmt)
    ).scalar_one_or_none()

    if target is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "not_found",
                "message": "User not found",
            },
        )

    if target.is_anonymized:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "conflict",
                "message": "Account is already deleted",
            },
        )

    return target


async def prepare_admin_mutation(
    db: AsyncSession,
    admin: User,
) -> None:

    await lock_admin_management(db)

    await db.refresh(admin)

    if (
        admin.role != "admin"
        or admin.is_anonymized
    ):
        raise HTTPException(
            status_code=403,
            detail={
                "code": "forbidden",
                "message": "Admin access required",
            },
        )


async def admin_update_user(
    db: AsyncSession,
    admin: User,
    target_id: uuid.UUID,
    data: AdminUserUpdateIn,
) -> User:

    await prepare_admin_mutation(db, admin)

    target = await get_admin_target(
        db,
        target_id,
        lock=True,
    )

    target = await update_user_profile(
        db,
        target,
        data,
    )

    await db.commit()
    await db.refresh(target)

    return target


async def admin_update_role(
    db: AsyncSession,
    admin: User,
    target_id: uuid.UUID,
    data: AdminRoleUpdateIn,
) -> User:

    await prepare_admin_mutation(db, admin)

    if admin.id == target_id:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "forbidden",
                "message": "You cannot change your own role",
            },
        )

    target = await get_admin_target(
        db,
        target_id,
        lock=True,
    )

    if target.role == data.role:
        await db.commit()
        return target

    if data.role == "user":
        await ensure_admin_removable(
            db,
            target,
        )

    target.role = data.role

    await db.execute(
        delete(Session).where(
            Session.user_id == target.id
        )
    )

    await db.commit()
    await db.refresh(target)

    return target


async def admin_delete_user(
    db: AsyncSession,
    admin: User,
    target_id: uuid.UUID,
) -> None:

    await prepare_admin_mutation(db, admin)

    if admin.id == target_id:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "forbidden",
                "message": (
                    "Use account settings to delete "
                    "your own account"
                ),
            },
        )

    target = await get_admin_target(
        db,
        target_id,
        lock=True,
    )

    await ensure_admin_removable(
        db,
        target,
    )

    await anonymize_account(
        db,
        target,
    )