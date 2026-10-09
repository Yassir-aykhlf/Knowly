from uuid import UUID

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.question import Question
from app.services.content import can_view


TITLE_MIN, TITLE_MAX = 10, 200
BODY_MIN, BODY_MAX = 30, 30_000
TAGS_MAX, TAG_LEN_MIN, TAG_LEN_MAX = 5, 2, 30
ATTACHMENTS_MAX = 10


def clean_question_fields(
    title: str,
        body: str, tags: list[str],
        attachment_ids: list[UUID]):
    errors = {}

    clean_title = title.strip()
    if not (TITLE_MIN <= len(clean_title) <= TITLE_MAX):
        errors["title"] = "Must be between 10 and 200 characters after trimming."

    body_len = len(body.strip())
    if body_len < BODY_MIN or len(body) > BODY_MAX:
        errors["body"] = "Must be between 30 and 30,000 characters."

    clean_tags = [t.strip() for t in tags if t.strip() != ""]
    if len(clean_tags) > TAGS_MAX:
        errors["tags"] = "At most 5 tags allowed."
    elif any(not (TAG_LEN_MIN <= len(t) <= TAG_LEN_MAX) for t in clean_tags):
        errors["tags"] = "Each tag must be between 2 and 30 characters."

    if len(attachment_ids) > ATTACHMENTS_MAX:
        errors["attachment_ids"] = "At most 10 attachments allowed."

    if errors:
        raise HTTPException(
            status_code=400,
            detail={"code": "validation_error",
                    "fields": errors, "message": "Validation failed"}
        )

    return {
        "title": clean_title,
        "body": body,
        "tags": clean_tags,
        "attachment_ids": attachment_ids
    }


async def load_viewable_question(db: AsyncSession, question_id, viewer) -> Question:
    result = await db.execute(select(Question).where(Question.id == question_id))
    question = result.scalar_one_or_none()

    if question is None or not can_view(question, viewer):
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "Question not found"},
        )

    return question
