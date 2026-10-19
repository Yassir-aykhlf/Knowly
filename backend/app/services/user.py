import uuid

from fastapi import Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.answer import Answer
from app.models.question import Question
from app.models.user import User
from app.schemas.common import excerpt
from app.schemas.user import (
    AuthorOut,
    FriendshipStateOut,
    ProfileAnswerOut,
    ProfileAnswerPage,
    ProfileQuestionOut,
    ProfileQuestionPage,
    ProfileUpdateIn,
    UserProfileOut,
)
from app.services.content import visible_filter, vote_totals
from app.services.friends import friendship_state_for


async def get_target_user(
    target_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
) -> User:
    stmt = select(User).where(User.id == target_id)

    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if user is None:
        raise HTTPException(
            status_code=404,
            detail={
                "code": "not_found",
                "message": "User not found",
            },
        )

    return user


async def get_user_profile(
    db: AsyncSession,
    target: User,
    viewer: User | None,
) -> UserProfileOut:
    if target.is_anonymized:
        bio = None
        avatar_url = None
    else:
        bio = target.bio
        avatar_url = target.avatar_path

    stmt = (
        select(func.count())
        .select_from(Question)
        .where(
            Question.author_id == target.id,
            visible_filter(Question, viewer),
        )
    )

    result = await db.execute(stmt)
    question_count = result.scalar_one()

    stmt = (
        select(func.count())
        .select_from(Answer)
        .where(
            Answer.author_id == target.id,
            visible_filter(Answer, viewer),
        )
    )

    result = await db.execute(stmt)
    answer_count = result.scalar_one()

    stmt = (
        select(func.count())
        .select_from(Answer)
        .join(
            Question,
            Question.accepted_answer_id == Answer.id,
        )
        .where(
            Answer.author_id == target.id,
            visible_filter(Answer, viewer),
        )
    )

    result = await db.execute(stmt)
    accepted_answer_count = result.scalar_one()

    friendship = None

    if (
        viewer is not None
        and viewer.id != target.id
        and not target.is_anonymized
    ):
        state, friendship_id = await friendship_state_for(
            db,
            viewer,
            target.id,
        )

        friendship = FriendshipStateOut(
            state=state,
            id=friendship_id,
        )

    return UserProfileOut(
        id=target.id,
        username=target.username,
        bio=bio,
        avatar_url=avatar_url,
        created_at=target.created_at,
        question_count=question_count,
        answer_count=answer_count,
        accepted_answer_count=accepted_answer_count,
        is_anonymized=target.is_anonymized,
        friendship=friendship,
    )


async def update_user_profile(
    db: AsyncSession,
    user: User,
    data: ProfileUpdateIn,
) -> User:
    changes = data.model_dump(exclude_unset=True)

    if "username" in changes and changes["username"] != user.username:
        stmt = select(User.id).where(
            User.username == changes["username"]
        )

        result = await db.execute(stmt)

        if result.scalar_one_or_none() is not None:
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "conflict",
                    "message": "Username already taken",
                    "fields": {
                        "username": "Username already taken",
                    },
                },
            )

    for field, value in changes.items():
        setattr(user, field, value)

    try:
        await db.flush()

    except IntegrityError as exc:
        await db.rollback()

        constraint_name = getattr(
            getattr(exc.orig, "__cause__", None),
            "constraint_name",
            None,
        )

        constraint_name = constraint_name or getattr(
            exc.orig,
            "constraint_name",
            None,
        )

        if (
            "username" in changes
            and constraint_name == "users_username_key"
        ):
            raise HTTPException(
                status_code=409,
                detail={
                    "code": "conflict",
                    "message": "Username already taken",
                    "fields": {
                        "username": "Username already taken",
                    },
                },
            ) from exc

        raise

    return user


async def get_user_questions(
    db: AsyncSession,
    target: User,
    viewer: User | None,
    page: int,
    limit: int,
) -> ProfileQuestionPage:
    stmt = (
        select(func.count())
        .select_from(Question)
        .where(
            Question.author_id == target.id,
            visible_filter(Question, viewer),
        )
    )

    result = await db.execute(stmt)
    total = result.scalar_one()

    offset = (page - 1) * limit

    stmt = (
        select(Question)
        .where(
            Question.author_id == target.id,
            visible_filter(Question, viewer),
        )
        .order_by(
            Question.created_at.desc(),
            Question.id.desc(),
        )
        .offset(offset)
        .limit(limit)
    )

    result = await db.execute(stmt)
    questions = result.scalars().all()

    question_ids = [question.id for question in questions]

    answer_counts: dict[uuid.UUID, int] = {}

    if question_ids:
        stmt = (
            select(Answer.question_id, func.count())
            .where(
                Answer.question_id.in_(question_ids),
                Answer.moderation_status == "approved",
            )
            .group_by(Answer.question_id)
        )

        result = await db.execute(stmt)
        rows = result.all()

        answer_counts = {
            question_id: count
            for question_id, count in rows
        }

    question_votes: dict[uuid.UUID, int] = await vote_totals(
        db,
        "question",
        question_ids,
    )

    author = AuthorOut(
        id=target.id,
        username=target.username,
        avatar_url=(
            None if target.is_anonymized else target.avatar_path
        ),
        is_anonymized=target.is_anonymized,
    )

    cards = []

    for question in questions:
        card = ProfileQuestionOut(
            id=question.id,
            title=question.title,
            excerpt=excerpt(question.body),
            tags=question.tags,
            author=author,
            vote_total=question_votes.get(question.id, 0),
            answer_count=answer_counts.get(question.id, 0),
            view_count=question.view_count,
            has_accepted_answer=(
                question.accepted_answer_id is not None
            ),
            created_at=question.created_at,
        )

        cards.append(card)

    return ProfileQuestionPage(
        items=cards,
        total=total,
        page=page,
        limit=limit,
    )


async def get_user_answers(
    db: AsyncSession,
    target: User,
    viewer: User | None,
    page: int,
    limit: int,
) -> ProfileAnswerPage:
    stmt = (
        select(func.count())
        .select_from(Answer)
        .where(
            Answer.author_id == target.id,
            visible_filter(Answer, viewer),
        )
    )

    result = await db.execute(stmt)
    total = result.scalar_one()

    stmt = (
        select(Answer)
        .where(
            Answer.author_id == target.id,
            visible_filter(Answer, viewer),
        )
        .order_by(
            Answer.created_at.desc(),
            Answer.id.desc(),
        )
        .offset((page - 1) * limit)
        .limit(limit)
    )

    result = await db.execute(stmt)
    answers = result.scalars().all()

    question_ids = list({
        answer.question_id
        for answer in answers
    })

    visible_questions = {}

    if question_ids:
        stmt = (
            select(Question)
            .where(
                Question.id.in_(question_ids),
                visible_filter(Question, viewer),
            )
        )

        result = await db.execute(stmt)
        questions = result.scalars().all()

        visible_questions = {
            question.id: question
            for question in questions
        }

    answer_ids = [answer.id for answer in answers]

    answer_votes = await vote_totals(
        db,
        "answer",
        answer_ids,
    )

    cards = []

    for answer in answers:
        parent = visible_questions.get(answer.question_id)

        if parent is None:
            question_title = "(removed question)"
            is_accepted = False
        else:
            question_title = parent.title
            is_accepted = (
                parent.accepted_answer_id == answer.id
            )

        card = ProfileAnswerOut(
            id=answer.id,
            question_id=answer.question_id,
            question_title=question_title,
            excerpt=excerpt(answer.body),
            vote_total=answer_votes.get(answer.id, 0),
            is_accepted=is_accepted,
            created_at=answer.created_at,
        )

        cards.append(card)

    return ProfileAnswerPage(
        items=cards,
        total=total,
        page=page,
        limit=limit,
    )
