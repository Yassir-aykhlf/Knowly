from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.moderation import screen_and_stage
from app.services.files import bind_attachments

from app.db.session import get_db
from app.models.question import Question
from app.schemas.question import QuestionCreateIn, QuestionOut
from app.models.user import User
from app.schemas.user import AuthorOut
from app.schemas.attachment import AttachmentOut
from app.services.auth import get_current_user

router = APIRouter(prefix="/questions", tags=["questions"])

TITLE_MIN, TITLE_MAX = 10, 200
BODY_MIN, BODY_MAX = 30, 30_000
TAGS_MAX, TAG_LEN_MIN, TAG_LEN_MAX = 5, 2, 30
ATTACHMENTS_MAX = 10


async def build_question_out(question: Question, user: User, attachments: list[AttachmentOut] | None = None) -> QuestionOut:
    attach = attachments if attachments is not None else []
    author = AuthorOut.from_user(user)

    return QuestionOut(
        id=question.id,
        title=question.title,
        body=question.body,
        tags=question.tags,
        author=author,
        moderation_status=question.moderation_status,
        moderation_note=question.moderation_note,
        answers=[],
        comments=[],
        vote_total=0,
        view_count=0,
        created_at=question.created_at,
        updated_at=question.updated_at,
        attachments=attach
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


@router.post("", response_model=QuestionOut, status_code=status.HTTP_201_CREATED)
async def create_question_endpoint(
    raw_payload: QuestionCreateIn,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
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

    attachments = await bind_attachments(
        db=db,
        attachment_ids=data.attachment_ids,
        parent_type="question",
        parent_id=new_question.id,
        user=currUser
    )

    await db.commit()
    await db.refresh(new_question)

    return await build_question_out(question=new_question,
                                    user=currUser,
                                    attachments=attachments)
