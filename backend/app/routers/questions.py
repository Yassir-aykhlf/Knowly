import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.moderation import screen_and_stage
from app.services.files import bind_attachments

from app.db.session import get_db
from app.models.question import Question
from app.schemas.question import QuestionCreateIn, QuestionOut
from app.models.user import User
from app.schemas.user import AuthorOut
from app.services.auth import get_current_user

router = APIRouter(prefix="/questions", tags=["questions"])


def validate_question_payload(payload: QuestionCreateIn) -> QuestionCreateIn:
    errors = {}

    clean_title = payload.title.strip()
    if not (10 <= len(clean_title) <= 200):
        errors["title"] = "Must be between 10 and 200 characters after trimming."

    body_len = len(payload.body.strip())
    if body_len < 30 or len(payload.body) > 30_000:
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


@router.post("", response_model=QuestionOut, status_code=status.HTTP_201_CREATED)
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
    await screen_and_stage(db=db, kind="question", text=text_to_screen, obj=new_question)

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
