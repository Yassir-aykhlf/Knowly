from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.user import RegisterIn
from app.schemas.user import UserMeOut
from app.services.auth import register_user
from app.services.session import set_session_cookie

router = APIRouter(prefix="/auth", tags=["auth"])

@router.post(
    "/register",
    response_model=UserMeOut,
    status_code=status.HTTP_201_CREATED,
)
async def register(
    data: RegisterIn,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> UserMeOut:

    user, token = await register_user(db, data)

    await db.commit()

    set_session_cookie(response, token)

    return UserMeOut.from_user(user)
