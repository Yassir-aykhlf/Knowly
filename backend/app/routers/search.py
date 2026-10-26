from datetime import date, datetime, time
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, literal, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.answer import Answer
from app.models.question import Question
from app.models.user import User
from app.models.vote import Vote
from app.schemas.common import excerpt
from app.schemas.search import SearchPage, SearchResult
from app.schemas.user import AuthorOut
from app.services.auth import get_optional_user
from app.services.content import visible_filter

router = APIRouter(prefix="/search", tags=["search"])


@router.get("", response_model=SearchPage)
async def search_questions(
    q: str | None = Query(None, max_length=200),
    tag: list[str] | None = Query(None),
    author: str | None = Query(None, max_length=30),
    status: Literal["unanswered", "answered", "accepted"] | None = None,
    from_date: date | None = Query(None, alias="from"),
    to_date: date | None = Query(None, alias="to"),
    sort: Literal["relevance", "newest", "votes", "answers"] = "relevance",
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    viewer: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    answer_counts = (
        select(Answer.question_id, func.count().label("total"))
        .where(Answer.moderation_status == "approved")
        .group_by(Answer.question_id)
        .subquery()
    )
    vote_totals = (
        select(Vote.target_id, func.sum(Vote.value).label("total"))
        .where(Vote.target_type == "question")
        .group_by(Vote.target_id)
        .subquery()
    )
    answer_count = func.coalesce(answer_counts.c.total, 0)
    vote_total = func.coalesce(vote_totals.c.total, 0)
    stmt = (
        select(Question, User, vote_total, answer_count)
        .join(User, Question.author_id == User.id)
        .outerjoin(answer_counts, answer_counts.c.question_id == Question.id)
        .outerjoin(vote_totals, vote_totals.c.target_id == Question.id)
        .where(visible_filter(Question, viewer))
    )
    if tag:
        stmt = stmt.where(Question.tags.contains(tag))
    if author is not None:
        stmt = stmt.where(func.lower(User.username) == author.lower())
    if status == "unanswered":
        stmt = stmt.where(answer_count == 0)
    elif status == "answered":
        stmt = stmt.where(answer_count > 0, Question.accepted_answer_id.is_(None))
    elif status == "accepted":
        stmt = stmt.where(Question.accepted_answer_id.is_not(None))
    if from_date is not None:
        stmt = stmt.where(Question.created_at >= datetime.combine(from_date, time.min))
    if to_date is not None:
        stmt = stmt.where(Question.created_at <= datetime.combine(to_date, time.max))

    query_text = (q or "").strip()
    highlight = literal(None)
    tsquery = None
    if query_text:
        tsquery = func.websearch_to_tsquery("english", query_text)
        stmt = stmt.where(Question.search_vector.bool_op("@@")(tsquery))
        highlight = func.ts_headline(
            "english",
            Question.title + "\n\n" + Question.body,
            tsquery,
            "StartSel=<mark>, StopSel=</mark>, MaxFragments=2",
        )

    total = await db.scalar(select(func.count()).select_from(stmt.subquery()))
    order = []
    if sort == "relevance" and tsquery is not None:
        order.append(func.ts_rank_cd(Question.search_vector, tsquery).desc())
    elif sort == "votes":
        order.append(vote_total.desc())
    elif sort == "answers":
        order.append(answer_count.desc())
    rows = await db.execute(
        stmt.add_columns(highlight)
        .order_by(*order, Question.created_at.desc(), Question.id.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    items = []
    for question, user, votes, answers, snippet in rows:
        plain_excerpt = excerpt(question.body)
        items.append(SearchResult(
            id=question.id,
            title=question.title,
            excerpt=plain_excerpt,
            highlight=snippet if query_text else plain_excerpt,
            tags=question.tags,
            author=AuthorOut.from_user(user),
            vote_total=votes,
            answer_count=answers,
            view_count=question.view_count,
            has_accepted_answer=question.accepted_answer_id is not None,
            created_at=question.created_at,
        ))
    return SearchPage(items=items, total=total, page=page, limit=limit)
