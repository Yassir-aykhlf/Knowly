from uuid import UUID
from collections import defaultdict

from app.models import User, user
from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_
from sqlalchemy.orm import selectinload

from app.services.content import can_view, viewer_votes, visible_filter, vote_totals
from app.services.files import attachments_for

from app.schemas.answer import AnswerOut
from app.schemas.comment import CommentOut
from app.schemas.question import QuestionOut
from app.schemas.user import AuthorOut

from app.models.comment import Comment
from app.models.answer import Answer
from app.models.question import Question

TITLE_MIN, TITLE_MAX = 10, 200
BODY_MIN, BODY_MAX = 30, 30_000
TAGS_MAX, TAG_LEN_MIN, TAG_LEN_MAX = 5, 2, 30
ATTACHMENTS_MAX = 10


async def build_question_out(
    db: AsyncSession,
    question: Question,
    user: User | None = None,
) -> QuestionOut:
    # 3. Answers (visible only), authors loaded in the same go
    result = await db.execute(
        select(Answer)
        .where(Answer.question_id == question.id, visible_filter(Answer, user))
        .options(selectinload(Answer.author))
    )
    answers = result.scalars().all()
    answer_ids = [a.id for a in answers]

    # 4. Comments in ONE query (question + all its answers), oldest first
    result = await db.execute(
        select(Comment)
        .where(
            or_(
                and_(Comment.parent_type == "question",
                     Comment.parent_id == question.id),
                and_(Comment.parent_type == "answer",
                     Comment.parent_id.in_(answer_ids)),
            ),
            visible_filter(Comment, user),
        )
        .order_by(Comment.created_at.asc())
    )
    comments = result.scalars().all()

    buckets: dict[tuple[str, UUID], list[CommentOut]] = defaultdict(list)
    for c in comments:
        buckets[(c.parent_type, c.parent_id)].append(c)

    # 5. Scores, viewer votes, attachments: one call for the question,
    #    one call for ALL answers together
    q_totals = await vote_totals(db, "question", [question.id])
    a_totals = await vote_totals(db, "answer", answer_ids)

    a_votes = await viewer_votes(db, user, "answer", answer_ids)

    q_attach = await attachments_for(db, "question", [question.id])
    a_attach = await attachments_for(db, "answer", answer_ids)

    accepted_id = question.accepted_answer_id

    answers.sort(
        key=lambda a: (a.id != accepted_id, -
                       a_totals.get(a.id, 0), a.created_at)
    )

    answers_out = [
        AnswerOut.from_answer(
            a,
            vote_total=a_totals.get(a.id, 0),
            my_vote=a_votes.get(a.id, 0),
            attachments=a_attach.get(a.id, []),
            comments=buckets[("answer", a.id)],
        )
        for a in answers
    ]

    return QuestionOut(
        id=question.id,
        title=question.title,
        body=question.body,
        tags=question.tags,
        author=AuthorOut.from_user(question.author),
        moderation_status=question.moderation_status,
        moderation_note=question.moderation_note,
        answers=answers_out,
        comments=buckets[("question", question.id)],
        vote_total=q_totals.get(question.id, 0),
        view_count=question.view_count,
        created_at=question.created_at,
        updated_at=question.updated_at,
        attachments=q_attach.get(question.id, []),
    )


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
            detail={
                "code": "validation_error",
                "fields": errors,
                "message": "Validation failed"}
        )

    return {
        "title": clean_title,
        "body": body,
        "tags": clean_tags,
        "attachment_ids": attachment_ids
    }


async def load_viewable_question(
        db: AsyncSession,
        question_id: UUID,
        viewer: User) -> Question:
    result = await db.execute(select(Question).where(Question.id == question_id))
    question = result.scalar_one_or_none()

    if question is None or not can_view(question, viewer):
        raise HTTPException(
            status_code=404,
            detail={"code": "not_found", "message": "Question not found"},
        )

    return question
