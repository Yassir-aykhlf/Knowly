import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.answer import Answer
from app.models.question import Question
from app.models.session import Session
from app.models.user import User
from app.schemas.user import (
    FriendshipOut,
    PasswordChangeIn,
    UserMeOut,
    UserProfileOut,
)
from app.services.auth import (
    get_current_user,
    get_current_user_and_session,
    get_optional_user,
)
from app.services.content import visible_filter
from app.services.friends import friendship_state_for
from app.services.security import hash_password, verify_password
from app.services.session import delete_other_sessions
router = APIRouter(prefix="/users", tags=["users"])

@router.get("/me", response_model=UserMeOut)
async def get_me(
    user: User = Depends(get_current_user),
) -> UserMeOut:
    return UserMeOut.from_user(user)

@router.get("/{user_id}", response_model=UserProfileOut)
async def get_public_profile(
    user_id: uuid.UUID,
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> UserProfileOut:
    user = await db.get(User, user_id)

    if user is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "not_found",
                "message": "User not found",
            },
        )

    question_result = await db.execute(
        select(func.count(Question.id)).where(
            Question.author_id == user.id,
            visible_filter(Question, viewer),
        )
    )
    question_count = question_result.scalar_one()

    answer_result = await db.execute(
        select(func.count(Answer.id)).where(
            Answer.author_id == user.id,
            visible_filter(Answer, viewer),
        )
    )
    answer_count = answer_result.scalar_one()

    accepted_answer_result = await db.execute(
        select(func.count(Answer.id))
        .join(
            Question,
            Question.accepted_answer_id == Answer.id,
        )
        .where(
            Answer.author_id == user.id,
        )
    )
    accepted_answer_count = accepted_answer_result.scalar_one()

    friendship = None

    if (
        viewer is not None
        and viewer.id != user.id
        and not user.is_anonymized
    ):
        state, friendship_id = await friendship_state_for(
            db,
            viewer,
            user.id,
        )

        friendship = FriendshipOut(
            state=state,
            id=friendship_id,
        )

    return UserProfileOut.from_user(
        user=user,
        question_count=question_count,
        answer_count=answer_count,
        accepted_answer_count=accepted_answer_count,
        friendship=friendship,
    )

@router.put("/me/password", status_code=204)
async def change_password(
    payload: PasswordChangeIn,
    user_and_session: tuple[User, Session] = Depends(
        get_current_user_and_session
    ),
    db: AsyncSession = Depends(get_db),
) -> None:
    user, current_session = user_and_session

    if (
        user.password_hash is None
        or not verify_password(payload.current_password, user.password_hash)
    ):
        raise HTTPException(
            status_code=401,
            detail={
                "code": "invalid_credentials",
                "message": "Invalid password",
                "fields": {
                    "current_password": "Incorrect password",
                },
            },
        )

    user.password_hash = hash_password(payload.new_password)

    await delete_other_sessions(
        db,
        user.id,
        keep_id=current_session.id,
    )

    await db.commit()