from fastapi import HTTPException
from sqlalchemy import delete, func, or_, select, text, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.ai import AiConversation
from app.models.friendship import Friendship
from app.models.message import Message
from app.models.notification import Notification
from app.models.session import Session
from app.models.user import User
from app.schemas.auth import AccountDeleteIn
from app.services.avatar import safe_remove_avatar
from app.services.security import verify_password
from app.services.admin import is_initial_admin


async def lock_admin_management(db: AsyncSession) -> None:
    await db.execute(
        text("SELECT pg_advisory_xact_lock(827361)")
    )


async def ensure_admin_removable(
    db: AsyncSession,
    user: User,
) -> None:
    if user.role != "admin":
        return

    if is_initial_admin(user.email):
        raise HTTPException(
            status_code=409,
            detail={
                "code": "conflict",
                "message": "The configured initial admin is protected",
            },
        )

    stmt = (
        select(func.count())
        .select_from(User)
        .where(
            User.role == "admin",
            User.is_anonymized.is_(False),
            User.id != user.id,
        )
    )

    remaining_admins = await db.scalar(stmt)

    if not remaining_admins:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "conflict",
                "message": "Cannot remove the last administrator",
            },
        )


def validate_deletion(
    user: User,
    data: AccountDeleteIn,
) -> None:
    if user.password_hash is not None:
        if (
            data.password is None
            or not verify_password(
                data.password,
                user.password_hash,
            )
        ):
            raise HTTPException(
                status_code=401,
                detail={
                    "code": "invalid_credentials",
                    "message": "Incorrect password",
                    "fields": {
                        "password": "Incorrect or missing password",
                    },
                },
            )

    elif data.confirm != "DELETE":
        raise HTTPException(
            status_code=400,
            detail={
                "code": "confirmation_required",
                "message": "Account deletion requires confirmation",
                "fields": {
                    "confirm": "Type DELETE to confirm",
                },
            },
        )


async def delete_account(
    db: AsyncSession,
    user: User,
    data: AccountDeleteIn,
) -> None:
    await lock_admin_management(db)
    await db.refresh(user)

    if user.is_anonymized:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "conflict",
                "message": "Account is already deleted",
            },
        )

    validate_deletion(user, data)

    await ensure_admin_removable(db, user)

    await anonymize_account(db, user)


async def anonymize_account(
    db: AsyncSession,
    user: User,
) -> None:
    user_id = user.id
    old_avatar_path = user.avatar_path

    try:
        await db.execute(
            delete(Session).where(
                Session.user_id == user_id
            )
        )

        await db.execute(
            delete(Message).where(
                or_(
                    Message.sender_id == user_id,
                    Message.receiver_id == user_id,
                )
            )
        )

        await db.execute(
            update(Notification)
            .where(Notification.actor_id == user_id)
            .values(
                actor_id=None,
                actor_count=func.greatest(
                    Notification.actor_count - 1,
                    1,
                ),
            )
        )

        await db.execute(
            delete(Notification).where(
                Notification.recipient_id == user_id
            )
        )

        await db.execute(
            delete(AiConversation).where(
                AiConversation.user_id == user_id
            )
        )

        await db.execute(
            delete(Friendship).where(
                or_(
                    Friendship.requester_id == user_id,
                    Friendship.addressee_id == user_id,
                )
            )
        )

        deleted_username = (
            f"[deleted_{uuid.uuid4().hex[:16]}]"
        )

        await db.execute(
            update(User)
            .where(User.id == user_id)
            .values(
                username=deleted_username,
                email=None,
                password_hash=None,
                bio=None,
                avatar_path=None,
                oauth_provider=None,
                oauth_subject=None,
                role="user",
                is_anonymized=True,
            )
        )

        await db.commit()

    except Exception:
        await db.rollback()
        raise

    safe_remove_avatar(old_avatar_path)