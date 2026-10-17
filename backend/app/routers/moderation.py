import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from app.db.session import get_db
from app.models.answer import Answer
from app.models.comment import Comment
from app.models.question import Question
from app.schemas.moderation import ModerationVerdict, PendingModerationItem, RejectIn
from app.schemas.user import AuthorOut
from app.services import notifications
from app.services.auth import require_admin

router = APIRouter(prefix='/moderation', tags=['moderation'], dependencies=[Depends(require_admin)])
MODELS = {'question': Question, 'answer': Answer, 'comment': Comment}


async def _contexts(db: AsyncSession, items: list) -> dict:
    answers = {obj.id: obj for kind, obj in items if kind == 'answer'}
    answer_ids = {obj.parent_id for kind, obj in items if kind == 'comment' and obj.parent_type == 'answer'}
    missing = answer_ids - answers.keys()
    if missing:
        answers.update((obj.id, obj) for obj in await db.scalars(select(Answer).where(Answer.id.in_(missing))))
    questions = {obj.id: obj for kind, obj in items if kind == 'question'}
    question_ids = {obj.question_id for obj in answers.values()}
    question_ids.update(obj.parent_id for kind, obj in items if kind == 'comment' and obj.parent_type == 'question')
    missing = question_ids - questions.keys()
    if missing:
        questions.update((obj.id, obj) for obj in await db.scalars(select(Question).where(Question.id.in_(missing))))
    contexts = {}
    for kind, obj in items:
        if kind == 'question':
            contexts[(kind, obj.id)] = (obj.id, None)
        elif kind == 'answer' and obj.question_id in questions:
            contexts[(kind, obj.id)] = (obj.question_id, questions[obj.question_id].author_id)
        elif kind == 'comment':
            parent = (questions if obj.parent_type == 'question' else answers).get(obj.parent_id)
            if parent is not None:
                question_id = parent.id if obj.parent_type == 'question' else parent.question_id
                if question_id in questions:
                    contexts[(kind, obj.id)] = (question_id, parent.author_id)
    return contexts


@router.get('/pending', response_model=list[PendingModerationItem])
async def pending_queue(
    limit: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    items = []
    for kind, model in MODELS.items():
        rows = await db.scalars(select(model).where(model.moderation_status == 'pending')
            .options(joinedload(model.author)).order_by(model.created_at, model.id).limit(limit))
        items.extend((kind, obj) for obj in rows)
    items.sort(key=lambda item: (item[1].created_at, str(item[1].id), item[0]))
    items = items[:limit]
    contexts = await _contexts(db, items)
    return [PendingModerationItem(
        type=kind, id=obj.id, title=obj.title if kind == 'question' else None,
        body=obj.body, author=AuthorOut.from_user(obj.author), moderation_note=obj.moderation_note,
        question_id=contexts.get((kind, obj.id), (None, None))[0], created_at=obj.created_at,
    ) for kind, obj in items]


async def _decide(db: AsyncSession, kind: str, id: uuid.UUID, note: str | None = None):
    model = MODELS.get(kind)
    if model is None:
        raise HTTPException(404, detail='Content not found')
    obj = await db.scalar(select(model).where(model.id == id).with_for_update()
        .execution_options(populate_existing=True))
    if obj is None:
        raise HTTPException(404, detail='Content not found')
    allowed = ('pending', 'rejected') if note is None else ('pending',)
    if obj.moderation_status not in allowed:
        raise HTTPException(409, detail='This content cannot receive that moderation verdict')
    context = (await _contexts(db, [(kind, obj)])).get((kind, obj.id))
    if context is None:
        raise HTTPException(404, detail='Parent content not found')
    question_id, parent_author_id = context
    approved = note is None
    obj.moderation_status = 'approved' if approved else 'rejected'
    obj.moderation_note = note
    await db.flush()
    await notifications.create_notification(
        db, recipient_id=obj.author_id, actor_id=None,
        event_type='moderation_approved' if approved else 'moderation_rejected',
        subject_type=kind, subject_id=obj.id, link=f'/questions/{question_id}',
    )
    if approved:
        await notifications.emit_content_approved(
            db, kind=kind, obj=obj, question_id=question_id, parent_author_id=parent_author_id,
        )
    result = ModerationVerdict(type=kind, id=obj.id, moderation_status=obj.moderation_status)
    await db.commit()
    return result


@router.put('/{kind}/{id}/approve', response_model=ModerationVerdict)
async def approve(kind: str, id: uuid.UUID, db: AsyncSession = Depends(get_db)):
    return await _decide(db, kind, id)


@router.put('/{kind}/{id}/reject', response_model=ModerationVerdict)
async def reject(kind: str, id: uuid.UUID, payload: RejectIn, db: AsyncSession = Depends(get_db)):
    return await _decide(db, kind, id, payload.note)
