import uuid

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.answer import Answer
from app.models.question import Question
from app.models.user import User
from app.schemas.vote import VoteIn, VoteOut
from app.services import content, notifications
from app.services.auth import get_current_user

router = APIRouter(tags=["votes"])


async def cast_vote(
    db: AsyncSession, user: User, target_type: str, target_id: uuid.UUID, value: int
) -> VoteOut:
    if target_type == "question":
        target = await db.get(Question, target_id)
        question = target
    else:
        target = await db.get(Answer, target_id)
        question = await db.get(Question, target.question_id) if target is not None else None

    if (
        target is None
        or question is None
        or not content.can_view(target, user)
        or not content.can_view(question, user)
    ):
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": f"{target_type.capitalize()} not found"},
        )

    if target.author_id == user.id:
        raise HTTPException(
            status_code=400,
            detail={"code": "self_vote", "message": "You can't vote on your own post"},
        )

    await notifications.notify_vote_if_new(
        db,
        actor=user,
        target_type=target_type,
        target_id=target.id,
        target_author_id=target.author_id,
        question_id=question.id,
        value=value,
    )
    return await content.apply_vote(db, user, target_type, target.id, value)


@router.post("/questions/{question_id}/vote", response_model=VoteOut)
async def vote_question(
    question_id: uuid.UUID,
    payload: VoteIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await cast_vote(db, user, "question", question_id, payload.value)


@router.post("/answers/{answer_id}/vote", response_model=VoteOut)
async def vote_answer(
    answer_id: uuid.UUID,
    payload: VoteIn,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await cast_vote(db, user, "answer", answer_id, payload.value)
