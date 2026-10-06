from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.models.session import Session

from app.services.auth import get_current_user, change_password
from app.services.session import get_current_session

from app.schemas.user import UserMeOut
from app.schemas.auth import PasswordChangeIn

from app.db.session import get_db


router = APIRouter(
    prefix="/users",
    tags=["users"],
)


@router.get(
    "/me",
    response_model=UserMeOut,
    status_code=status.HTTP_200_OK,
)
async def get_me(
    user: User = Depends(get_current_user),
) -> UserMeOut:
    return UserMeOut.from_user(user)


@router.put(
    "/me/password",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def update_password(
    data: PasswordChangeIn,
    user: User = Depends(get_current_user),
    current_session: Session = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
) -> None:

    await change_password(
        db,
        user,
        current_session,
        data,
    )

    await db.commit()