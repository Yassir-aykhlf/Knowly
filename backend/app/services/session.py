import secrets
import uuid
from datetime import datetime, timedelta

from fastapi import Depends, HTTPException, Request, Response
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.db.session import get_db
from app.models.session import Session


SESSION_COOKIE_NAME = "knowly_session"


async def create_session(
    db: AsyncSession,
    user_id: uuid.UUID,
) -> str:
    token = secrets.token_urlsafe(32)
    hashed_token = Session.hash_token(token)

    session = Session(
        user_id=user_id,
        token_hash=hashed_token,
        expires_at=datetime.utcnow()
        + timedelta(days=settings.SESSION_LIFETIME_DAYS),
    )

    db.add(session)
    await db.flush()

    return token


async def delete_session(
    db: AsyncSession,
    session: Session,
) -> None:
    await db.delete(session)
    await db.flush()


async def delete_other_sessions(
    db: AsyncSession,
    user_id: uuid.UUID,
    keep_id: uuid.UUID,
) -> None:
    stmt = delete(Session).where(
        Session.user_id == user_id,
        Session.id != keep_id,
    )

    await db.execute(stmt)


def set_session_cookie(
    response: Response,
    raw_token: str,
) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=raw_token,
        max_age=settings.SESSION_LIFETIME_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )


async def get_optional_session(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Session | None:
    raw_token = request.cookies.get(SESSION_COOKIE_NAME)

    if raw_token is None:
        return None

    token_hash = Session.hash_token(raw_token)

    stmt = select(Session).where(
        Session.token_hash == token_hash
    )

    result = await db.execute(stmt)
    session = result.scalar_one_or_none()

    if session is None:
        return None

    if datetime.utcnow() >= session.expires_at:
        await delete_session(db, session)
        await db.commit()
        return None

    return session


async def get_current_session(
    session: Session | None = Depends(get_optional_session),
) -> Session:
    if session is None:
        raise HTTPException(
            status_code=401,
            detail={
                "code": "unauthenticated",
                "message": "Authentication required",
            },
        )

    return session
