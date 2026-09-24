import uuid
from dataclasses import dataclass

from fastapi import HTTPException
from sqlalchemy import delete, func, or_, select, true
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.vote import VoteOut
from app.models.answer import Answer
from app.models.comment import Comment
from app.models.question import Question
from app.models.vote import Vote

def visible_filter(model, user):
    if user is None:
        return model.moderation_status == "approved"
    if user.role == "admin":
        return true()
    return or_(
        model.moderation_status == "approved",
        model.author_id == user.id,
    )

def can_view(content, user) -> bool:
    if content.moderation_status == "approved":
        return True
    if user is None:
        return False
    return user.role == "admin" or content.author_id == user.id


async def load_owned(db: AsyncSession, model, obj_id: uuid.UUID, user, kind: str):
    obj = await db.get(model, obj_id)
    if obj is None or not can_view(obj, user):
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


async def vote_totals(db: AsyncSession, target_type: str, ids: list) -> dict:
    totals = {target_id: 0 for target_id in ids}
    if not ids:
        return totals
    rows = await db.execute(
        select(Vote.target_id, func.sum(Vote.value))
        .where(Vote.target_type == target_type, Vote.target_id.in_(ids))
        .group_by(Vote.target_id)
    )
    totals.update({target_id: int(total) for target_id, total in rows.all()})
    return totals


async def viewer_votes(db: AsyncSession, user, target_type: str, ids: list) -> dict:
    if user is None or not ids:
        return {}
    rows = await db.execute(
        select(Vote.target_id, Vote.value).where(
            Vote.voter_id == user.id,
            Vote.target_type == target_type,
            Vote.target_id.in_(ids),
        )
    )
    return dict(rows.all())

async def apply_vote(db: AsyncSession, user, target_type: str, target_id, value: int):
    if value == 0:
        await db.execute(
            delete(Vote).where(
                Vote.voter_id == user.id,
                Vote.target_type == target_type,
                Vote.target_id == target_id,
            )
        )
    else:
        stmt = insert(Vote).values(
            voter_id=user.id, target_type=target_type, target_id=target_id, value=value
        )
        await db.execute(
            stmt.on_conflict_do_update(
                constraint="uq_votes_voter_target",
                set_={"value": stmt.excluded.value},
            )
        )
    await db.commit()
    totals = await vote_totals(db, target_type, [target_id])
    mine = await viewer_votes(db, user, target_type, [target_id])
    return VoteOut(vote_total=totals[target_id], my_vote=mine.get(target_id, 0))


async def question_context(db: AsyncSession, parent_type: str, parent_id: uuid.UUID):
    if parent_type == "question":
        row = (
            await db.execute(
                select(Question.id, Question.author_id).where(Question.id == parent_id)
            )
        ).first()
        return None if row is None else (row.id, row.author_id, row.author_id)
    if parent_type == "answer":
        row = (
            await db.execute(
                select(Question.id, Question.author_id, Answer.author_id)
                .select_from(Answer)
                .join(Answer.question)
                .where(Answer.id == parent_id)
            )
        ).first()
        return None if row is None else tuple(row)
    return None


async def delete_comments_for(db: AsyncSession, parent_type: str, parent_ids: list) -> None:
    if parent_ids:
        await db.execute(
            delete(Comment).where(
                Comment.parent_type == parent_type,
                Comment.parent_id.in_(parent_ids),
            )
        )

async def delete_votes_for(db: AsyncSession, target_type: str, target_ids: list) -> None:
    if target_ids:
        await db.execute(
            delete(Vote).where(
                Vote.target_type == target_type,
                Vote.target_id.in_(target_ids),
            )
        )
