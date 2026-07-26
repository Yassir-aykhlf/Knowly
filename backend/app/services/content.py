import uuid

from fastapi import HTTPException
from sqlalchemy import delete, func, or_, select, true
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.answer import Answer
from app.models.comment import Comment
from app.models.question import Question
from app.models.user import User
from app.models.vote import Vote
from app.schemas.vote import VoteOut

def visible_filter(model, user: User | None):
    if user is not None and user.role == "admin":
        return true()
    conditions = [model.moderation_status == "approved"]
    if user is not None:
        conditions.append(model.author_id == user.id)
    if len(conditions) == 1:
        return conditions[0]
    return or_(*conditions)

def can_view(content, user: User | None) -> bool:
    if content.moderation_status == "approved":
        return True
    if user is None:
        return False
    return user.role == "admin" or content.author_id == user.id

async def load_owned(db: AsyncSession, model, obj_id: uuid.UUID, user: User, kind: str):
    obj = await db.get(model, obj_id)
    if obj is None:
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": f"{kind.capitalize()} not found"},
        )
    if obj.author_id != user.id:
        raise HTTPException(
            status_code=403,
            detail={
                "code": "forbidden",
                "message": f"Only the author can modify this {kind}",
            },
        )
    return obj

async def vote_totals(
    db: AsyncSession, target_type: str, ids: list[uuid.UUID]
) -> dict[uuid.UUID, int]:
    if not ids:
        return {}
    result = await db.execute(
        select(Vote.target_id, func.coalesce(func.sum(Vote.value), 0))
        .where(Vote.target_type == target_type, Vote.target_id.in_(ids))
        .group_by(Vote.target_id)
    )
    return {row[0]: int(row[1]) for row in result.all()}


async def viewer_votes(
    db: AsyncSession, user: User | None, target_type: str, ids: list[uuid.UUID]
) -> dict[uuid.UUID, int]:
    if user is None or not ids:
        return {}
    result = await db.execute(
        select(Vote.target_id, Vote.value).where(
            Vote.voter_id == user.id,
            Vote.target_type == target_type,
            Vote.target_id.in_(ids),
        )
    )
    return {row[0]: int(row[1]) for row in result.all()}

async def apply_vote(
    db: AsyncSession, user: User, target_type: str, target_id: uuid.UUID, value: int
) -> VoteOut:
    if value == 0:
        await db.execute(
            delete(Vote).where(
                Vote.voter_id == user.id,
                Vote.target_type == target_type,
                Vote.target_id == target_id,
            )
        )
    else:
        stmt = pg_insert(Vote).values(
            voter_id=user.id,
            target_type=target_type,
            target_id=target_id,
            value=value,
        )
        stmt = stmt.on_conflict_do_update(
            index_elements=["voter_id", "target_type", "target_id"],
            set_={"value": value},
        )
        await db.execute(stmt)
    await db.commit()
    totals = await vote_totals(db, target_type, [target_id])
    mine = await viewer_votes(db, user, target_type, [target_id])
    return VoteOut(vote_total=totals.get(target_id, 0), my_vote=mine.get(target_id, 0))

async def question_context(
    db: AsyncSession, parent_type: str, parent_id: uuid.UUID
) -> tuple[uuid.UUID, uuid.UUID, uuid.UUID] | None:
    if parent_type == "question":
        question = await db.get(Question, parent_id)
        if question is None:
            return None
        return question.id, question.author_id, question.author_id
    answer = await db.get(Answer, parent_id)
    if answer is None:
        return None
    question = await db.get(Question, answer.question_id)
    if question is None:
        return None
    return question.id, question.author_id, answer.author_id

async def delete_comments_for(
    db: AsyncSession, parent_type: str, parent_ids: list[uuid.UUID]
) -> None:
    if not parent_ids:
        return
    await db.execute(
        delete(Comment).where(
            Comment.parent_type == parent_type, Comment.parent_id.in_(parent_ids)
        )
    )

async def delete_votes_for(
    db: AsyncSession, target_type: str, target_ids: list[uuid.UUID]
) -> None:
    if not target_ids:
        return
    await db.execute(
        delete(Vote).where(
            Vote.target_type == target_type, Vote.target_id.in_(target_ids)
        )
    )