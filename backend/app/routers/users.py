from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.session import Session
from app.models.user import User
from app.schemas.user import PasswordChangeIn, UserMeOut
from app.services.auth import get_current_user, get_current_user_and_session
from app.services.security import hash_password, verify_password
from app.services.session import delete_other_sessions

router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserMeOut)
async def get_me(
    user: User = Depends(get_current_user),
) -> UserMeOut:
    return UserMeOut.from_user(user)


@router.put("/me/password", status_code=204)
async def change_password(
    payload: PasswordChangeIn,
    user_and_session: tuple[User, Session] = Depends(
        get_current_user_and_session
    ),
    db: AsyncSession = Depends(get_db),
) -> None:
    user, current_session = user_and_session

    if (
        user.password_hash is None
        or not verify_password(payload.current_password, user.password_hash)
    ):
        raise HTTPException(
            status_code=401,
            detail={
                "code": "invalid_credentials",
                "message": "Invalid password",
                "fields": {
                    "current_password": "Incorrect password",
                },
            },
        )

    user.password_hash = hash_password(payload.new_password)

    await delete_other_sessions(
        db,
        user.id,
        keep_id=current_session.id,
    )

    await db.commit()