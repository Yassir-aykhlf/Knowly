from sqlalchemy import select, func, exists
from uuid import UUID
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.services.moderation import screen_and_stage
from app.services.content import load_owned, visible_filter,  vote_totals

from app.db.session import get_db

from app.schemas.question import QuestionCreateIn, QuestionOut, QuestionPage, QuestionListItem
from app.schemas.user import AuthorOut
from app.schemas.common import excerpt

from app.services.auth import get_current_user, get_optional_user
from app.services.questions import build_question_out, clean_question_fields, load_viewable_question

from app.models.vote import Vote
from app.models.user import User
from app.models.question import Question
from app.models.answer import Answer

router = APIRouter(prefix="/questions", tags=["questions"])


@router.put("/{question_id}", response_model=QuestionOut)
async def update_question(
        question_id: UUID,
        payload: QuestionCreateIn,
        user: User | None = Depends(get_optional_user),
        db: AsyncSession = Depends(get_db)):
    """update (question by it's id) request handler"""
    # 1. load + validate (ownership first, so a stranger gets 403 before any 400)
    question = await load_owned(
        db=db, model=Question,
        obj_id=question_id,
        user=user,
        kind="question")

    title, body, tags, attachment_ids = clean_question_fields(
        title=payload.title,
        body=payload.body,
        tags=payload.tags,
        attachment_ids=payload.attachment_ids)

    question.title = title
    question.body = body
    question.tags = tags
    question.attachment_ids = attachment_ids

    # 2. screen again: the new verdict overwrites the old status
    await screen_and_stage(db=db, kind="question", text=body, obj=question)

    # 3. finish
    # TODO(stub): re-bind attachments here
    await db.commit()
    await db.refresh(question)
    return await build_question_out(db, question, user)


@router.delete("/{question_id}", response_model=QuestionOut)
async def update_question(
        question_id: UUID,
        user: User | None = Depends(get_optional_user),
        db: AsyncSession = Depends(get_db)):
    """delete (question by it's id) request handler"""
    return None


@router.get("", response_model=QuestionPage)
async def list_questions(
    sort: Literal["newest", "votes", "unanswered"] = "newest",
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    viewer: User | None = Depends(get_optional_user),  # None when logged out
):
    """get (question list into QuestionPage as QuestionListItem) request handler"""
    # Conditions shared by the count and the page query
    conditions = [visible_filter(Question, viewer)]
    if sort == "unanswered":
        # Plain "approved", not visible_filter: otherwise an answerer's own
        # pending answer would hide the question from them.
        conditions.append(
            ~exists().where(
                Answer.question_id == Question.id,
                Answer.moderation_status == "approved",  # ⚠ column/enum name
            )
        )

    total = await db.scalar(
        select(func.count()).select_from(Question).where(*conditions)
    )

    stmt = select(Question).where(
        *conditions).options(selectinload(Question.author))

    if sort == "votes":
        vote_sum = (
            select(
                Vote.target_id.label("question_id"),
                func.sum(Vote.value).label("score"),
            )
            .where(Vote.target_type == "question")
            .group_by(Vote.target_id)
            .subquery()
        )
        stmt = stmt.outerjoin(
            vote_sum, vote_sum.c.question_id == Question.id
        ).order_by(
            func.coalesce(vote_sum.c.score, 0).desc(),
            Question.created_at.desc(),
            Question.id.desc(),  # tie-breaker
        )
    else:  # newest and unanswered
        stmt = stmt.order_by(Question.created_at.desc(), Question.id.desc())

    result = await db.scalars(stmt.offset((page - 1) * limit).limit(limit))
    questions = result.all()

    # Card numbers for this page's ids only
    ids = [q.id for q in questions]

    answer_counts = {}
    if ids:
        rows = await db.execute(
            select(Answer.question_id, func.count())
            .where(Answer.question_id.in_(ids), Answer.moderation_status == "approved")
            .group_by(Answer.question_id)
        )
        answer_counts = dict(rows.all())

    vtotals = await vote_totals(db=db, target_type="questions", ids=ids)

    items = [
        QuestionListItem(
            id=q.id,
            title=q.title,
            excerpt=excerpt(q.body),
            tags=q.tags,
            author=AuthorOut.from_user(q.author),
            vote_total=vtotals.get(q.id, 0),
            answer_count=answer_counts.get(q.id, 0),
            created_at=q.created_at,
            view_count=q.view_count,
            has_accepted_answer=True,
        )
        for q in questions
    ]
    return QuestionPage(items=items, total=total, page=page, limit=limit)


@router.get("/{question_id}", response_model=QuestionOut)
async def get_question_endpoint(
    question_id: UUID,
    user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db)
):
    """get (single question by id) request handler"""
    question = await load_viewable_question(db=db, question_id=question_id, viewer=user)
    return await build_question_out(db=db, question=question, user=user)


@ router.post("", response_model=QuestionOut, status_code=status.HTTP_201_CREATED)
async def create_question_endpoint(
    raw_payload: QuestionCreateIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """post request handler"""
    currUser = current_user
    title, body, tags, attachment_ids = clean_question_fields(
        title=raw_payload.title,
        body=raw_payload.body,
        tags=raw_payload.tags,
        attachment_ids=raw_payload.attachment_ids)

    new_question = Question(
        title=title,
        body=body,
        tags=tags,
        author=current_user)

    db.add(new_question)
    await db.flush()

    # STUB: swap for D-09
    text_to_screen = f"{title}\n\n{body}"
    await screen_and_stage(db=db, kind="question", text=text_to_screen, obj=new_question)

    await db.commit()
    await db.refresh(new_question)

    return await build_question_out(
        db=db,
        question=new_question,
        user=currUser)
