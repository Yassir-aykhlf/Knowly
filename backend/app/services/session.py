from app.models.session import Session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import delete
import uuid
import secrets
from datetime import datetime, timedelta
from app.config import settings
from typing import TYPE_CHECKING

from fastapi import Response


if TYPE_CHECKING :
    from app.models.user import User

SESSION_COOKIE_NAME = "knowly_session"


async def create_session(db: AsyncSession, user_id: uuid.UUID) -> str:
    token = secrets.token_urlsafe(32)

    hashed_token = Session.hash_token(token)

    session = Session(
        user_id=user_id,
        token_hash=hashed_token,
        expires_at=datetime.utcnow() + timedelta(days=settings.SESSION_LIFETIME_DAYS),
    )

    db.add(session)
    await db.flush()

    return token

async def delete_session(db: AsyncSession, session: Session)-> None:
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


    

