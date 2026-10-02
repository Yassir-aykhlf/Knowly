import uuid

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.answer import Answer
from app.models.comment import Comment
from app.models.question import Question
from app.models.user import User
from app.schemas.comment import CommentCreate, CommentOut, CommentUpdate
from app.services import content, notifications
from app.services.auth import get_current_user
from app.services.screening import screen_and_stage

router = APIRouter(prefix="/comments", tags=["comments"])

COMMENT_BODY_MIN, COMMENT_BODY_MAX = 1, 1000

PARENT_MODELS = {"question": Question, "answer": Answer}


def _clean_comment_body(body: str) -> str:
    body = body.strip()
    if not (COMMENT_BODY_MIN <= len(body) <= COMMENT_BODY_MAX):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "validation_error",
                "message": "Validation failed",
                "fields": {
                    "body": f"Must be between {COMMENT_BODY_MIN} and {COMMENT_BODY_MAX} characters."
                },
            },
        )
    return body


def _parent_not_found() -> HTTPException:
    return HTTPException(
        status_code=404,
        detail={"code": "not_found", "message": "Parent content not found"},
    )


async def _resolve_parent(
    db: AsyncSession, parent_type: str, parent_id: uuid.UUID, user: User
) -> tuple[Question | Answer, uuid.UUID]:
    parent = await db.get(PARENT_MODELS[parent_type], parent_id)
    if parent is None or not content.can_view(parent, user):
        raise _parent_not_found()

    if parent_type == "question":
        return parent, parent.id

    question = await db.get(Question, parent.question_id)
    if question is None or not content.can_view(question, user):
        raise _parent_not_found()
    return parent, question.id


@router.post("", response_model=CommentOut, status_code=status.HTTP_201_CREATED)
async def create_comment(
    payload: CommentCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    body = _clean_comment_body(payload.body)
    parent, question_id = await _resolve_parent(db, payload.parent_type, payload.parent_id, user)

    comment = Comment(
        author_id=user.id,
        parent_type=payload.parent_type,
        parent_id=parent.id,
        body=body,
    )
    db.add(comment)

    await screen_and_stage(
        db,
        kind="comment",
        obj=comment,
        text=body,
        question_id=question_id,
        parent_author_id=parent.author_id,
    )

    await db.commit()
    await db.refresh(comment)
    await db.refresh(comment, ["author"])
    return CommentOut.from_comment(comment)


@router.put("/{comment_id}", response_model=CommentOut)
async def update_comment(
    comment_id: uuid.UUID,
    payload: CommentUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    comment = await content.load_owned(db, Comment, comment_id, user, "comment")
    body = _clean_comment_body(payload.body)

    context = await content.question_context(db, comment.parent_type, comment.parent_id)
    question_id, question_author_id, parent_author_id = context or (None, None, None)

    comment.body = body

    await screen_and_stage(
        db,
        kind="comment",
        obj=comment,
        text=body,
        question_id=question_id,
        parent_author_id=parent_author_id,
        editing=True,
        question_author_id=question_author_id,
    )

    await db.commit()
    await db.refresh(comment)
    await db.refresh(comment, ["author"])
    return CommentOut.from_comment(comment)


@router.delete("/{comment_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_comment(
    comment_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    comment = await content.load_owned(db, Comment, comment_id, user, "comment")

    if comment.moderation_status == "approved":
        context = await content.question_context(db, comment.parent_type, comment.parent_id)
        if context is not None:
            question_id, question_author_id, _ = context
            await notifications.create_notification(
                db,
                recipient_id=question_author_id,
                actor_id=user.id,
                event_type="content_deleted",
                subject_type="comment",
                subject_id=comment.id,
                link=f"/questions/{question_id}",
            )

    await db.execute(delete(Comment).where(Comment.id == comment.id))
    await db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)
