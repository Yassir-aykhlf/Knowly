from fastapi import APIRouter, Depends, Request, Response, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.schemas.auth import LoginIn, RegisterIn
from app.schemas.user import UserMeOut
from app.services.auth import login_user, logout_user, register_user
from app.services.session import SESSION_COOKIE_NAME, set_session_cookie


router = APIRouter(
    prefix="/auth",
    tags=["auth"],
)


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


@router.post(
    "/login",
    response_model=UserMeOut,
    status_code=status.HTTP_200_OK,
)
async def login(
    data: LoginIn,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> UserMeOut:
    user, token = await login_user(db, data)

    await db.commit()

    set_session_cookie(response, token)

    return UserMeOut.from_user(user)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> None:
    raw_token = request.cookies.get(SESSION_COOKIE_NAME)

    await logout_user(db, raw_token)

    await db.commit()

    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
    )
