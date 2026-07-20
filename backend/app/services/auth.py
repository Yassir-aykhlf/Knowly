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
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User

_dev_user: User | None = None

def _get_dev_user() -> User:
    global _dev_user
    if _dev_user is None:
        _dev_user = User(
            id=uuid.uuid4(),
            username="devuser",
            email="dev@example.com",
            role="user",
        )
    return _dev_user

async def get_optional_user(request: Request, db: AsyncSession = Depends(get_db)) -> User | None:
    return _get_dev_user()

async def get_current_user(user: User | None = Depends(get_optional_user)) -> User:
    if user is None:
        raise HTTPException(
            status_code=401,
            detail={"code": "unauthenticated", "message": "Authentication required"}
        )
    return user

async def require_admin(user: User = Depends(get_current_user)) -> User:
    return user
