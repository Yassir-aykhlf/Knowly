from fastapi import Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.session import get_db
from app.models.session import Session
from app.models.user import User
from app.schemas.auth import LoginIn, PasswordChangeIn, RegisterIn
from app.services.security import (
    DUMMY_PASSWORD_HASH,
    hash_password,
    verify_password,
)
from app.services.session import (
    create_session,
    delete_other_sessions,
    delete_session,
    get_optional_session,
)


async def get_optional_user(
    session: Session | None = Depends(get_optional_session),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    if session is None:
        return None

    stmt = select(User).where(User.id == session.user_id)

    result = await db.execute(stmt)

    return result.scalar_one_or_none()


async def get_current_user(
    user: User | None = Depends(get_optional_user),
) -> User:
    if user is None:
        raise HTTPException(
            status_code=401,
            detail={
                "code": "unauthenticated",
                "message": "Authentication required",
            },
        )

    return user


async def require_admin(
    user: User = Depends(get_current_user),
) -> User:
    if user.role == "admin":
        return user

    raise HTTPException(
        status_code=403,
        detail={
            "code": "forbidden",
            "message": "Admin access required",
        },
    )


async def register_user(
    db: AsyncSession,
    data: RegisterIn,
) -> tuple[User, str]:
    stmt = select(User).where(
        (User.username == data.username)
        | (User.email == data.email)
    )

    result = await db.execute(stmt)
    users = result.scalars().all()

    fields = {}

    for user in users:
        if user.email == data.email:
            fields["email"] = "Email already registered"

        if user.username == data.username:
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

    role = (
        "admin"
        if (
            settings.INITIAL_ADMIN_EMAIL
            and str(data.email).lower()
            == settings.INITIAL_ADMIN_EMAIL.lower()
        )
        else "user"
    )

    hashed_password = hash_password(data.password)

    user = User(
        email=data.email,
        username=data.username,
        password_hash=hashed_password,
        role=role,
    )

    db.add(user)
    await db.flush()

    raw_token = await create_session(db, user.id)

    return user, raw_token


async def login_user(
    db: AsyncSession,
    data: LoginIn,
) -> tuple[User, str]:
    stmt = select(User).where(User.email == data.email)

    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is not None and user.password_hash is not None:
        password_hash = user.password_hash
    else:
        password_hash = DUMMY_PASSWORD_HASH

    password_ok = verify_password(
        data.password,
        password_hash,
    )

    if (
        user is None
        or user.password_hash is None
        or not password_ok
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

    raw_token = await create_session(db, user.id)

    return user, raw_token


async def logout_user(
    db: AsyncSession,
    raw_token: str | None,
) -> None:
    if raw_token is None:
        return

    token_hash = Session.hash_token(raw_token)

    stmt = select(Session).where(
        Session.token_hash == token_hash
    )

    result = await db.execute(stmt)
    session = result.scalar_one_or_none()

    if session is not None:
        await delete_session(db, session)


async def change_password(
    db: AsyncSession,
    user: User,
    current_session: Session,
    data: PasswordChangeIn,
) -> None:
    password_ok = (
        user.password_hash is not None
        and verify_password(
            data.current_password,
            user.password_hash,
        )
    )

    if not password_ok:
        raise HTTPException(
            status_code=401,
            detail={
                "code": "invalid_credentials",
                "message": "Current password is incorrect",
                "fields": {
                    "current_password": "Current password is incorrect",
                },
            },
        )

    new_password_hash = hash_password(
        data.new_password
    )

    user.password_hash = new_password_hash

    await delete_other_sessions(
        db,
        user.id,
        current_session.id,
    )

    await db.flush()
