import uuid

from fastapi import HTTPException
from sqlalchemy import delete, func, or_, update
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
    validate_deletion(user, data)

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

      
        deleted_username = f"[deleted_{uuid.uuid4().hex[:16]}]"

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
                is_anonymized=True,
            )
        )

        await db.commit()

    except Exception:
        await db.rollback()
        raise

    safe_remove_avatar(old_avatar_path)
