import logging
import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.ai import AiConversation
from app.models.answer import Answer
from app.models.comment import Comment
from app.models.question import Question
from app.models.user import User
from app.routers.questions import ATTACHMENTS_MAX, BODY_MAX, BODY_MIN
from app.schemas.answer import AnswerCreate, AnswerOut, AnswerUpdate
from app.schemas.comment import CommentOut
from app.services import content, files, notifications
from app.services.auth import get_current_user
from app.services.screening import screen_and_stage

logger = logging.getLogger("knowly.answers")

router = APIRouter(tags=["answers"])


async def _load_question(db: AsyncSession, question_id: uuid.UUID, user: User | None) -> Question:
    question = await db.get(Question, question_id)
    if question is None or not content.can_view(question, user):
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "Question not found"},
        )
    return question


def _clean_answer_fields(body: str, attachment_ids: list) -> str:
    errors = {}

    body = body.strip()
    if not (BODY_MIN <= len(body) <= BODY_MAX):
        errors["body"] = f"Must be between {BODY_MIN} and {BODY_MAX} characters."

    if len(attachment_ids) > ATTACHMENTS_MAX:
        errors["attachment_ids"] = f"At most {ATTACHMENTS_MAX} attachments allowed."

    if errors:
        raise HTTPException(
            status_code=400,
            detail={"code": "validation_error", "message": "Validation failed", "fields": errors},
        )
    return body


async def _owns_conversation(db: AsyncSession, raw_id: str | None, user: User) -> bool:
    if raw_id is None:
        return False
    try:
        conversation_id = uuid.UUID(raw_id)
    except ValueError:
        return False
    found = await db.scalar(
        select(AiConversation.id).where(
            AiConversation.id == conversation_id,
            AiConversation.user_id == user.id,
        )
    )
    return found is not None


async def answer_out(db: AsyncSession, answer: Answer, viewer: User | None) -> AnswerOut:
    rows = await db.execute(
        select(Comment)
        .options(selectinload(Comment.author))
        .where(
            Comment.parent_type == "answer",
            Comment.parent_id == answer.id,
            content.visible_filter(Comment, viewer),
        )
        .order_by(Comment.created_at)
    )
    comments = [CommentOut.from_comment(c) for c in rows.scalars().all()]

    totals = await content.vote_totals(db, "answer", [answer.id])
    mine = await content.viewer_votes(db, viewer, "answer", [answer.id])
    # STUB: swap for D-10
    attachments = await files.attachments_for(db, "answer", [answer.id])

    return AnswerOut.from_answer(
        answer,
        vote_total=totals[answer.id],
        my_vote=mine.get(answer.id, 0),
        comments=comments,
        attachments=attachments.get(answer.id, []),
    )


@router.post(
    "/questions/{question_id}/answers",
    response_model=AnswerOut,
    status_code=status.HTTP_201_CREATED,
)
async def create_answer(
    question_id: uuid.UUID,
    payload: AnswerCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    question = await _load_question(db, question_id, user)
    body = _clean_answer_fields(payload.body, payload.attachment_ids)

    is_ai_assisted = payload.is_ai_assisted and await _owns_conversation(
        db, payload.from_conversation_id, user
    )

    answer = Answer(
        question_id=question.id,
        author_id=user.id,
        body=body,
        is_ai_assisted=is_ai_assisted,
    )
    db.add(answer)

    await screen_and_stage(
        db,
        kind="answer",
        obj=answer,
        text=body,
        question_id=question.id,
        parent_author_id=question.author_id,
    )

    # STUB: swap for D-09
    await files.bind_attachments(
        db,
        attachment_ids=payload.attachment_ids,
        parent_type="answer",
        parent_id=answer.id,
        user=user,
    )

    await db.commit()
    await db.refresh(answer)
    await db.refresh(answer, ["author"])
    return AnswerOut.from_answer(answer)


@router.put("/answers/{answer_id}", response_model=AnswerOut)
async def update_answer(
    answer_id: uuid.UUID,
    payload: AnswerUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    answer = await content.load_owned(db, Answer, answer_id, user, "answer")
    body = _clean_answer_fields(payload.body, payload.attachment_ids)
    question = await db.get(Question, answer.question_id)

    answer.body = body

    await screen_and_stage(
        db,
        kind="answer",
        obj=answer,
        text=body,
        question_id=question.id,
        parent_author_id=question.author_id,
        editing=True,
        question_author_id=question.author_id,
    )

    # STUB: swap for D-09
    await files.bind_attachments(
        db,
        attachment_ids=payload.attachment_ids,
        parent_type="answer",
        parent_id=answer.id,
        user=user,
    )

    await db.commit()
    await db.refresh(answer)
    await db.refresh(answer, ["author"])
    return await answer_out(db, answer, user)


@router.delete("/answers/{answer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_answer(
    answer_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    answer = await content.load_owned(db, Answer, answer_id, user, "answer")

    if answer.moderation_status == "approved":
        question_author_id = await db.scalar(
            select(Question.author_id).where(Question.id == answer.question_id)
        )
        await notifications.create_notification(
            db,
            recipient_id=question_author_id,
            actor_id=user.id,
            event_type="content_deleted",
            subject_type="answer",
            subject_id=answer.id,
            link=f"/questions/{answer.question_id}",
        )

    await content.delete_comments_for(db, "answer", [answer.id])
    await content.delete_votes_for(db, "answer", [answer.id])
    # STUB: swap for D-10
    paths = await files.delete_attachments_for(db, "answer", [answer.id])

    await db.execute(
        update(Question)
        .where(Question.accepted_answer_id == answer.id)
        .values(accepted_answer_id=None, updated_at=Question.updated_at)
    )
    await db.execute(delete(Answer).where(Answer.id == answer.id))
    await db.commit()

    for path in paths:
        try:
            files.delete_file(path)
        except Exception:
            logger.warning("Could not delete file %s", path, exc_info=True)

    return Response(status_code=status.HTTP_204_NO_CONTENT)
