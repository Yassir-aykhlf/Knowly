import uuid

from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.answer import Answer
from app.models.question import Question
from app.models.session import Session
from app.models.user import User
from app.models.vote import Vote
from app.schemas.common import excerpt
from app.schemas.user import (
    AuthorOut,
    FriendshipOut,
    PasswordChangeIn,
    ProfileAnswerOut,
    ProfileAnswerPage,
    ProfileQuestionOut,
    ProfileQuestionPage,
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
@router.post("/me/heartbeat", status_code=204)
async def heartbeat(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    now = datetime.utcnow()
    cutoff = now - timedelta(seconds=30)

    await db.execute(
        update(User)
        .where(
            User.id == user.id,
            User.last_seen < cutoff,
        )
        .values(last_seen=now)
    )

    await db.commit()

    return Response(status_code=204)

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


@router.get("/{user_id}/questions", response_model=ProfileQuestionPage)
async def get_profile_questions(
    user_id: uuid.UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> ProfileQuestionPage:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "User not found"},
        )

    visibility = visible_filter(Question, viewer)
    total = (
        await db.execute(
            select(func.count(Question.id)).where(
                Question.author_id == user.id,
                visibility,
            )
        )
    ).scalar_one()

    questions = list(
        (
            await db.execute(
                select(Question)
                .where(Question.author_id == user.id, visibility)
                .order_by(Question.created_at.desc(), Question.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
            )
        ).scalars().all()
    )
    question_ids = [question.id for question in questions]

    vote_totals: dict[uuid.UUID, int] = {}
    answer_counts: dict[uuid.UUID, int] = {}
    if question_ids:
        vote_rows = await db.execute(
            select(Vote.target_id, func.coalesce(func.sum(Vote.value), 0))
            .where(
                Vote.target_type == "question",
                Vote.target_id.in_(question_ids),
            )
            .group_by(Vote.target_id)
        )
        vote_totals = {target_id: int(total) for target_id, total in vote_rows.all()}

        count_rows = await db.execute(
            select(Answer.question_id, func.count(Answer.id))
            .where(
                Answer.question_id.in_(question_ids),
                Answer.moderation_status == "approved",
            )
            .group_by(Answer.question_id)
        )
        answer_counts = {
            question_id: int(count) for question_id, count in count_rows.all()
        }

    author = AuthorOut.from_user(user)
    items = [
        ProfileQuestionOut(
            id=question.id,
            title=question.title,
            excerpt=excerpt(question.body),
            tags=question.tags,
            author=author,
            vote_total=vote_totals.get(question.id, 0),
            answer_count=answer_counts.get(question.id, 0),
            view_count=question.view_count,
            has_accepted_answer=question.accepted_answer_id is not None,
            created_at=question.created_at,
        )
        for question in questions
    ]

    return ProfileQuestionPage(items=items, total=total, page=page, limit=limit)


@router.get("/{user_id}/answers", response_model=ProfileAnswerPage)
async def get_profile_answers(
    user_id: uuid.UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
) -> ProfileAnswerPage:
    user = await db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "User not found"},
        )

    answer_visibility = visible_filter(Answer, viewer)
    total = (
        await db.execute(
            select(func.count(Answer.id)).where(
                Answer.author_id == user.id,
                answer_visibility,
            )
        )
    ).scalar_one()

    answers = list(
        (
            await db.execute(
                select(Answer)
                .where(Answer.author_id == user.id, answer_visibility)
                .order_by(Answer.created_at.desc(), Answer.id.desc())
                .offset((page - 1) * limit)
                .limit(limit)
            )
        ).scalars().all()
    )
    answer_ids = [answer.id for answer in answers]
    question_ids = list({answer.question_id for answer in answers})

    
    visible_questions: dict[uuid.UUID, Question] = {}
    if question_ids:
        parent_rows = await db.execute(
            select(Question).where(
                Question.id.in_(question_ids),
                visible_filter(Question, viewer),
            )
        )
        visible_questions = {
            question.id: question for question in parent_rows.scalars().all()
        }

    vote_totals: dict[uuid.UUID, int] = {}
    if answer_ids:
        vote_rows = await db.execute(
            select(Vote.target_id, func.coalesce(func.sum(Vote.value), 0))
            .where(
                Vote.target_type == "answer",
                Vote.target_id.in_(answer_ids),
            )
            .group_by(Vote.target_id)
        )
        vote_totals = {target_id: int(total) for target_id, total in vote_rows.all()}

    items: list[ProfileAnswerOut] = []
    for answer in answers:
        parent = visible_questions.get(answer.question_id)
        items.append(
            ProfileAnswerOut(
                id=answer.id,
                question_id=answer.question_id,
                question_title=(
                    parent.title if parent is not None else "(removed question)"
                ),
                excerpt=excerpt(answer.body),
                vote_total=vote_totals.get(answer.id, 0),
                is_accepted=(
                    parent is not None and parent.accepted_answer_id == answer.id
                ),
                created_at=answer.created_at,
            )
        )

    return ProfileAnswerPage(items=items, total=total, page=page, limit=limit)

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