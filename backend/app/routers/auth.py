from fastapi import APIRouter, Depends, HTTPException, Request, Response
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.auth import LoginIn
from app.schemas.user import RegisterIn, UserMeOut
from app.services.security import (
    DUMMY_PASSWORD_HASH,
    hash_password,
    verify_password,
)
from app.services.session import (
    SESSION_COOKIE_NAME,
    clear_session_cookie,
    create_session,
    delete_session,
    get_session,
    set_session_cookie,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def is_initial_admin(email: str) -> bool:
    admin = settings.INITIAL_ADMIN_EMAIL
    return bool(admin) and email.lower() == admin.lower()


@router.post("/register", status_code=201, response_model=UserMeOut)
async def register(
    payload: RegisterIn,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> UserMeOut:

    result = await db.execute(
        select(User).where(
            or_(
                User.email == payload.email,
                User.username == payload.username,
            )
        )
    )

    fields = {}

    for existing in result.scalars():
        if existing.email == payload.email:
            fields["email"] = "Email already registered"

        if existing.username == payload.username:
            fields["username"] = "Username already taken"

    if fields:
        raise HTTPException(
            status_code=409,
            detail={
                "code": "conflict",
                "message": "Account already exists",
                "fields": fields,
            },
        )

    user = User(
        email=payload.email,
        username=payload.username,
        password_hash=hash_password(payload.password),
        role="admin" if is_initial_admin(payload.email) else "user",
    )

    db.add(user)

    await db.flush()

    raw_token, _ = await create_session(db, user.id)

    set_session_cookie(response, raw_token)

    await db.commit()

    return UserMeOut.from_user(user)


@router.post("/login", response_model=UserMeOut)
async def login(
    payload: LoginIn,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> UserMeOut:
    result = await db.execute(
        select(User).where(User.email == payload.email)
    )
    user = result.scalar_one_or_none()

    password_hash = (
        user.password_hash
        if user is not None and user.password_hash is not None
        else DUMMY_PASSWORD_HASH
    )

    password_valid = verify_password(
        payload.password,
        password_hash,
    )

    if (
        user is None
        or user.password_hash is None
        or not password_valid
    ):
        raise HTTPException(
            status_code=401,
            detail={
                "code": "invalid_credentials",
                "message": "Invalid email or password",
                "fields": {
                    "oauth_hint": "true",
                },
            },
        )

    raw_token, _ = await create_session(db, user.id)

    set_session_cookie(response, raw_token)

    await db.commit()

    return UserMeOut.from_user(user)


@router.post("/logout", status_code=204)
async def logout(
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_db),
) -> None:
    raw_token = request.cookies.get(SESSION_COOKIE_NAME)

    session = await get_session(db, raw_token)

    if session is not None:
        await delete_session(db, session)
        await db.commit()

    clear_session_cookie(response)

