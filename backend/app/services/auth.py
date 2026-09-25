import uuid
from datetime import datetime

from fastapi import Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.user import User
from app.models.session import Session

from app.schemas.user import RegisterIn 
from app.config import settings

from app.services.security import hash_password
from app.services.session import create_session

from app.services.session import SESSION_COOKIE_NAME 


async def get_optional_user(request: Request, db: AsyncSession = Depends(get_db)) -> User | None:
    raw_token = request.cookies.get(SESSION_COOKIE_NAME)
    if raw_token is None:
        return None
    hash_token = Session.hash_token(raw_token)

    query = select(Session).options(selectinload(Session.user)).where(Session.token_hash == hash_token)

    result = await db.execute(query)

    session = result.scalar_one_or_none()

    if session is None:
        return None
    
    if datetime.utcnow() >= session.expires_at :
        await db.delete(session)
        await db.flush()
        return None
    
    return session.user
    



async def get_current_user(user: User | None = Depends(get_optional_user)) -> User:
    if user is None:
        raise HTTPException(
            status_code=401,
            detail={"code": "unauthenticated", "message": "Authentication required"}
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
          }
    )


async def register_user(
        db: AsyncSession, 
        data : RegisterIn, 
)->tuple[User, str]:
    stmt = select(User).where((User.username == data.username) | (User.email == data.email) )
    result =await  db.execute(stmt)
    users = result.scalars().all()
    fields = {}
    for user in users :
        if user.email == data.email :
            fields["email"] = "Email already registered"
        if user.username == data.username :
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
        if str(data.email).lower() == settings.INITIAL_ADMIN_EMAIL.lower()
        else "user"
    )
    hashed_password = hash_password(data.password)

    user = User(
        email = data.email,
        username = data.username,
        password_hash = hashed_password,
        role = role,
    )
    db.add(user)
    await db.flush()

    raw_token = await create_session(db, user.id)
    return user, raw_token



