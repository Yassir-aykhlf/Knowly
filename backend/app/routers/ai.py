import uuid

from fastapi import APIRouter, Depends, HTTPException, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.config import settings
from app.db.session import get_db
from app.models.ai import AiConversation, AiMessage
from app.models.question import Question
from app.models.user import User
from app.schemas.ai import ConversationCreate, ConversationDetail, ConversationOut, QuestionContext
from app.services.auth import get_current_user
from app.services.content import can_view

router = APIRouter(prefix="/ai", tags=["ai"])


async def load_own_conversation(db: AsyncSession, id: uuid.UUID, user: User) -> AiConversation:
    conversation = await db.scalar(select(AiConversation).where(
        AiConversation.id == id, AiConversation.user_id == user.id,
    ).options(selectinload(AiConversation.question)))
    if conversation is None:
        raise HTTPException(404, detail="Conversation not found")
    return conversation


def conversation_out(conversation: AiConversation, user: User) -> ConversationOut:
    question = conversation.question
    return ConversationOut(
        id=conversation.id, title=conversation.title,
        question=QuestionContext.model_validate(question)
        if question is not None and can_view(question, user) else None,
        created_at=conversation.created_at, updated_at=conversation.updated_at,
    )


@router.post("/conversations", response_model=ConversationOut, status_code=201)
async def create_conversation(
    payload: ConversationCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    question = None
    if payload.question_id is not None:
        question = await db.get(Question, payload.question_id)
        if question is None or not can_view(question, user):
            raise HTTPException(404, detail="Question not found")
    conversation = AiConversation(
        user_id=user.id, question=question,
        title=f"Help with: {question.title}"[:80] if question is not None else None,
    )
    db.add(conversation)
    await db.flush()
    result = conversation_out(conversation, user)
    await db.commit()
    return result


@router.get("/conversations", response_model=list[ConversationOut])
async def list_conversations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conversations = await db.scalars(select(AiConversation)
        .where(AiConversation.user_id == user.id)
        .options(selectinload(AiConversation.question))
        .order_by(AiConversation.updated_at.desc(), AiConversation.id.desc()))
    return [conversation_out(conversation, user) for conversation in conversations]


@router.get("/conversations/{id}", response_model=ConversationDetail)
async def get_conversation(
    id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conversation = await load_own_conversation(db, id, user)
    messages = await db.scalars(select(AiMessage)
        .where(AiMessage.conversation_id == conversation.id)
        .order_by(AiMessage.created_at, AiMessage.id))
    return ConversationDetail(
        **conversation_out(conversation, user).model_dump(), messages=list(messages),
    )


@router.delete("/conversations/{id}", status_code=204)
async def delete_conversation(
    id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conversation = await load_own_conversation(db, id, user)
    await db.delete(conversation)
    await db.commit()
    return Response(status_code=204)
