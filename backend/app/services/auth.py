"""Auth dependency — STUB (Launch Pad seam).

Real opaque-session authentication is task **A-01**. Until that ships, this hands
every request a hardcoded in-memory "dev user" so the frontend and the other
lanes can be built without a working login. It completely ignores the session
cookie.

Why a stub and not the real thing? So Lane B/C/D can write protected endpoints
(`Depends(get_current_user)`) on day one. When A-01 lands, replace the body of
`get_optional_user` with a real cookie -> session -> user lookup; the signatures
here are the final ones, so callers won't change.
"""
import uuid

from fastapi import Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User

from app.services.session import (
    SESSION_COOKIE_NAME,
    get_session,
)

async def get_optional_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User | None:
    raw_token = request.cookies.get(SESSION_COOKIE_NAME)

    session = await get_session(db, raw_token)
    if session is None:
        return None

    result = await db.execute(
        select(User).where(User.id == session.user_id)
    )

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
    if user.role != "admin":
        raise HTTPException(
            status_code=403,
            detail={
                "code": "forbidden",
                "message": "Admin access required",
            },
        )

    return user

