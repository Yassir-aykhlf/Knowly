from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import RegisterIn, UserMeOut
from app.services.security import hash_password
from app.services.session import create_session, set_session_cookie

router = APIRouter(prefix="/auth", tags=["auth"])


def is_initial_admin(email: str) -> bool:
    # STUB: swap for D-06 helper
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