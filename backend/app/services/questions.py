from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.question import Question
from app.services.content import can_view


async def load_viewable_question(db: AsyncSession, question_id, viewer) -> Question:
    result = await db.execute(select(Question).where(Question.id == question_id))
    question = result.scalar_one_or_none()

    if question is None or not can_view(question, viewer):
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "Question not found"},
        )

    return question
