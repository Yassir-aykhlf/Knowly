import uuid
from datetime import datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field, ConfigDict
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.question import Question, QuestionCreateIn, QuestionOut
from app.models.user import User
from app.schemas.user import AuthorOut
from app.services.auth import get_current_user

router = APIRouter(tags=["questions"])


def validate_question_payload(payload: QuestionCreateIn) -> QuestionCreateIn:
    errors = {}

    clean_title = payload.title.strip()
    if not (10 <= len(clean_title) <= 200):
        errors["title"] = "Must be between 10 and 200 characters after trimming."

    if not (30 <= len(payload.body) <= 30_000):
        errors["body"] = "Must be between 30 and 30,000 characters."

    clean_tags = [t.strip() for t in payload.tags if t.strip() != ""]
    if len(clean_tags) > 5:
        errors["tags"] = "At most 5 tags allowed."
    elif any(not (2 <= len(t) <= 30) for t in clean_tags):
        errors["tags"] = "Each tag must be between 2 and 30 characters."

    if len(payload.attachment_ids) > 10:
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


async def screen_and_stage(db: AsyncSession, *, kind: str, obj: Any, text: str, **kw: Any) -> None:
    obj.moderation_status = "approved"
    obj.moderation_note = None
    await db.flush()


# STUB: swap for D-09
async def bind_attachments(db: AsyncSession, *, attachment_ids: list[int], parent_type: str, parent_id: uuid.UUID, user: User) -> list[Any]:
    return []


@router.post("/questions", response_model=QuestionOut, status_code=status.HTTP_201_CREATED)
async def create_question_endpoint(
    raw_payload: QuestionCreateIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    data = validate_question_payload(raw_payload)

    new_question = Question(
        title=data.title,
        body=data.body,
        tags=data.tags,
        author=current_user,
    )

    db.add(new_question)
    await db.flush()

    text_to_screen = f"{data.title}\n\n{data.body}"
    await screen_and_stage(db=db, kind="question", obj=new_question, text=text_to_screen)

    attachments = await bind_attachments(
        db=db,
        attachment_ids=data.attachment_ids,
        parent_type="question",
        parent_id=new_question.id,
        user=current_user
    )

    author = AuthorOut.from_user(current_user)
    await db.commit()
    await db.refresh(new_question)

    return QuestionOut(
        id=new_question.id,
        title=new_question.title,
        body=new_question.body,
        tags=new_question.tags,
        author=author,
        moderation_status=new_question.moderation_status,
        moderation_note=new_question.moderation_note,
        answers=[],
        comments=[],
        vote_total=0,
        view_count=0,
        created_at=new_question.created_at,
        updated_at=new_question.updated_at,
        attachments=attachments,
    )
