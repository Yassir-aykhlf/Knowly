from fastapi import APIRouter, Depends, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime, timedelta
from fastapi import Response
from sqlalchemy import update

from app.models.user import User
from app.models.session import Session

from app.services.auth import get_current_user, change_password, get_optional_user
from app.services.session import get_current_session
from app.services.user import get_target_user, get_user_profile, update_user_profile
from app.services.user import get_user_questions
from app.services.user import get_user_answers
from app.services.avatar import upload_avatar, remove_avatar
from app.services.heartbeat import update_last_seen

from fastapi import File, UploadFile

from app.services.avatar import (
    upload_avatar,
    remove_avatar,
)


from app.schemas.user import UserMeOut, UserProfileOut,ProfileAnswerPage,ProfileQuestionPage, ProfileUpdateIn
from app.schemas.auth import PasswordChangeIn

from app.db.session import get_db


router = APIRouter(
    prefix="/users",
    tags=["users"],
)


@router.get(
    "/me",
    response_model=UserMeOut,
    status_code=status.HTTP_200_OK,
)
async def get_me(
    user: User = Depends(get_current_user),
) -> UserMeOut:
    return UserMeOut.from_user(user)


@router.put(
    "/me/password",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def update_password(
    data: PasswordChangeIn,
    user: User = Depends(get_current_user),
    current_session: Session = Depends(get_current_session),
    db: AsyncSession = Depends(get_db),
) -> None:

    await change_password(
        db,
        user,
        current_session,
        data,
    )

    await db.commit()


@router.put(
    "/me",
    response_model=UserMeOut,
    status_code=status.HTTP_200_OK,
)
async def update_me(
    data: ProfileUpdateIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserMeOut:
    user = await update_user_profile(db, user, data)
    await db.commit()
    await db.refresh(user)
    return UserMeOut.from_user(user)


@router.get(
    "/{target_id}",
    response_model=UserProfileOut,
)
async def get_public_profile(
    target: User = Depends(get_target_user),
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> UserProfileOut:
    return await get_user_profile(
        db,
        target,
        viewer,
    )

@router.get(
    "/{target_id}/questions",
    response_model=ProfileQuestionPage,
)
async def get_profile_questions(
    target: User = Depends(get_target_user),
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
) -> ProfileQuestionPage:
    return await get_user_questions(
        db=db,
        target=target,
        viewer=viewer,
        page=page,
        limit=limit,
    )

@router.get(
    "/{target_id}/answers",
    response_model=ProfileAnswerPage,
)
async def get_profile_answers(
    target: User = Depends(get_target_user),
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, ge=1, le=100),
) -> ProfileAnswerPage:
    return await get_user_answers(
        db=db,
        target=target,
        viewer=viewer,
        page=page,
        limit=limit,
    )


@router.post(
    "/me/avatar",
    response_model=UserMeOut,
    status_code=status.HTTP_200_OK,
)
async def post_avatar(
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserMeOut:

    user = await upload_avatar(db, user, file)

    return UserMeOut.from_user(user)


@router.delete(
    "/me/avatar",
    response_model=UserMeOut,
    status_code=status.HTTP_200_OK,
)
async def delete_avatar(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> UserMeOut:

    user = await remove_avatar(db, user)

    return UserMeOut.from_user(user)


@router.post("/me/heartbeat", status_code=204)
async def heartbeat(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await update_last_seen(db, user.id)

    return Response(status_code=204)