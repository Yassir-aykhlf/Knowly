from sqlalchemy import select, and_, or_, func, exists
from collections import defaultdict
from uuid import UUID
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy import select, or_, and_

from app.services.moderation import screen_and_stage
from app.services.content import visible_filter,  vote_totals, viewer_votes

from app.db.session import get_db

from app.schemas.question import QuestionCreateIn, QuestionOut, QuestionPage, QuestionListItem
from app.schemas.user import AuthorOut
from app.schemas.answer import AnswerOut
from app.schemas.comment import CommentOut
from app.schemas.common import excerpt

from app.services.auth import get_current_user, get_optional_user
from app.services.questions import load_viewable_question
from app.services.files import attachments_for

from app.models.vote import Vote
from app.models.user import User
from app.models.question import Question
from app.models.answer import Answer
from app.models.comment import Comment

router = APIRouter(prefix="/questions", tags=["questions"])

TITLE_MIN, TITLE_MAX = 10, 200
BODY_MIN, BODY_MAX = 30, 30_000
TAGS_MAX, TAG_LEN_MIN, TAG_LEN_MAX = 5, 2, 30
ATTACHMENTS_MAX = 10


@router.put("/{question_id}", response_model=QuestionOut)
async def update_question(question_id: UUID,
                          user: User | None = Depends(get_optional_user),
                          db: AsyncSession = Depends(get_db)):
    """update (question by it's id) request handler"""
    return None


@router.delete("/{question_id}", response_model=QuestionOut)
async def update_question(question_id: UUID,
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


async def build_question_out(
    db: AsyncSession,
    question: Question,
    user: User | None = None,
) -> QuestionOut:
    # 3. Answers (visible only), authors loaded in the same go
    result = await db.execute(
        select(Answer)
        .where(Answer.question_id == question.id, visible_filter(Answer, user))
        .options(selectinload(Answer.author))
    )
    answers = result.scalars().all()
    answer_ids = [a.id for a in answers]

    # 4. Comments in ONE query (question + all its answers), oldest first
    result = await db.execute(
        select(Comment)
        .where(
            or_(
                and_(Comment.parent_type == "question",
                     Comment.parent_id == question.id),
                and_(Comment.parent_type == "answer",
                     Comment.parent_id.in_(answer_ids)),
            ),
            visible_filter(Comment, user),
        )
        .order_by(Comment.created_at.asc())
    )
    comments = result.scalars().all()

    buckets: dict[tuple[str, UUID], list[CommentOut]] = defaultdict(list)
    for c in comments:
        buckets[(c.parent_type, c.parent_id)].append(c)

    # 5. Scores, viewer votes, attachments: one call for the question,
    #    one call for ALL answers together
    q_totals = await vote_totals(db, "question", [question.id])
    a_totals = await vote_totals(db, "answer", answer_ids)

    q_votes = await viewer_votes(db, user, "question", [question.id])
    a_votes = await viewer_votes(db, user, "answer", answer_ids)

    q_attach = await attachments_for(db, "question", [question.id])
    a_attach = await attachments_for(db, "answer", answer_ids)

    accepted_id = question.accepted_answer_id

    answers.sort(
        key=lambda a: (a.id != accepted_id, -
                       a_totals.get(a.id, 0), a.created_at)
    )

    answers_out = [
        AnswerOut.from_answer(
            a,
            vote_total=a_totals.get(a.id, 0),
            my_vote=a_votes.get(a.id, 0),
            attachments=a_attach.get(a.id, []),
            comments=buckets[("answer", a.id)],
        )
        for a in answers
    ]

    return QuestionOut(
        id=question.id,
        title=question.title,
        body=question.body,
        tags=question.tags,
        author=AuthorOut.from_user(question.author),
        moderation_status=question.moderation_status,
        moderation_note=question.moderation_note,
        answers=answers_out,
        comments=buckets[("question", question.id)],
        vote_total=q_totals.get(question.id, 0),
        view_count=question.view_count,
        created_at=question.created_at,
        updated_at=question.updated_at,
        attachments=q_attach.get(question.id, []),
    )


def validate_question_payload(payload: QuestionCreateIn) -> QuestionCreateIn:
    errors = {}

    clean_title = payload.title.strip()
    if not (TITLE_MIN <= len(clean_title) <= TITLE_MAX):
        errors["title"] = "Must be between 10 and 200 characters after trimming."

    body_len = len(payload.body.strip())
    if body_len < BODY_MIN or len(payload.body) > BODY_MAX:
        errors["body"] = "Must be between 30 and 30,000 characters."

    clean_tags = [t.strip() for t in payload.tags if t.strip() != ""]
    if len(clean_tags) > TAGS_MAX:
        errors["tags"] = "At most 5 tags allowed."
    elif any(not (TAG_LEN_MIN <= len(t) <= TAG_LEN_MAX) for t in clean_tags):
        errors["tags"] = "Each tag must be between 2 and 30 characters."

    if len(payload.attachment_ids) > ATTACHMENTS_MAX:
        errors["attachment_ids"] = "At most 10 attachments allowed."

    if errors:
        raise HTTPException(
            status_code=400,
            detail={"code": "validation_error",
                    "fields": errors, "message": "Validation failed"}
        )

    return QuestionCreateIn(
        title=clean_title,
        body=payload.body,
        tags=clean_tags,
        attachment_ids=payload.attachment_ids
    )


@ router.post("", response_model=QuestionOut, status_code=status.HTTP_201_CREATED)
async def create_question_endpoint(
    raw_payload: QuestionCreateIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """post request handler"""
    currUser = current_user
    data = validate_question_payload(raw_payload)

    new_question = Question(
        title=data.title,
        body=data.body,
        tags=data.tags,
        author=current_user
    )

    db.add(new_question)
    await db.flush()

    # STUB: swap for D-09
    text_to_screen = f"{data.title}\n\n{data.body}"
    await screen_and_stage(db=db, kind="question", text=text_to_screen, obj=new_question)

    await db.commit()
    await db.refresh(new_question)

    return await build_question_out(db=db,
                                    question=new_question,
                                    user=currUser)
