import secrets
from datetime import datetime, timedelta

from fastapi import Response
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.session import Session

SESSION_COOKIE_NAME = "knowly_session"
_TOKEN_NBYTES = 32


async def create_session(db: AsyncSession, user_id) -> tuple[str, Session]:
    raw_token = secrets.token_urlsafe(_TOKEN_NBYTES)

    session = Session(
        user_id=user_id,
        expires_at=datetime.utcnow()
        + timedelta(days=settings.SESSION_LIFETIME_DAYS),
    )
    session.set_token(raw_token)

    db.add(session)
    await db.flush()

    return raw_token, session


async def get_session(
    db: AsyncSession, raw_token: str | None
) -> Session | None:
    if not raw_token:
        return None

    token_hash = Session.hash_token(raw_token)

    result = await db.execute(
        select(Session).where(Session.token_hash == token_hash)
    )
    session = result.scalar_one_or_none()

    if session is None:
        return None

    if session.expires_at <= datetime.utcnow():
        await db.delete(session)
        await db.flush()
        return None

    return session


async def delete_session(
    db: AsyncSession, session: Session
) -> None:
    await db.delete(session)
    await db.flush()


async def delete_other_sessions(
    db: AsyncSession,
    user_id,
    keep_id,
) -> None:
    stmt = delete(Session).where(Session.user_id == user_id)

    if keep_id is not None:
        stmt = stmt.where(Session.id != keep_id)

    await db.execute(stmt)
    await db.flush()


def set_session_cookie(response: Response, raw_token: str) -> None:
    response.set_cookie(
        key=SESSION_COOKIE_NAME,
        value=raw_token,
        max_age=settings.SESSION_LIFETIME_DAYS * 24 * 60 * 60,
        httponly=True,
        secure=True,
        samesite="lax",
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(
        key=SESSION_COOKIE_NAME,
        path="/",
    )