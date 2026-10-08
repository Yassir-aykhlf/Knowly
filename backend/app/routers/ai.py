import asyncio
import json
import logging
import math
import uuid
from datetime import datetime, timedelta

import anyio
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker
from sqlalchemy.orm import selectinload

from app.config import settings
from app.db.session import get_db
from app.models.ai import AiConversation, AiMessage
from app.models.question import Question
from app.models.user import User
from app.schemas.ai import ConversationCreate, ConversationDetail, ConversationOut, MessageCreate, QuestionContext
from app.services import llm
from app.services.auth import get_current_user
from app.services.content import can_view

router = APIRouter(prefix="/ai", tags=["ai"])
logger = logging.getLogger("knowly.ai")


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


async def _persist_reply(sessions, conversation_id, user_id, content):
    async with sessions() as db:
        conversation = await db.scalar(select(AiConversation).where(
            AiConversation.id == conversation_id, AiConversation.user_id == user_id,
        ).with_for_update())
        if conversation is None:
            return
        now = datetime.utcnow()
        db.add(AiMessage(
            conversation_id=conversation_id, role="assistant", content=content, created_at=now,
        ))
        conversation.updated_at = now
        await db.commit()


async def _finish_reply(stream, sessions, conversation_id, user_id, content, completed):
    try:
        if stream is not None:
            await stream.aclose()
    except Exception:
        logger.warning("Could not close the upstream assistant stream")
    if content or completed:
        await _persist_reply(sessions, conversation_id, user_id, content)


async def _stream_reply(request, messages, sessions, conversation_id, user_id):
    parts = []
    stream = None
    completed = False
    error = None
    try:
        stream = llm.chat_stream(messages)
        async for token in stream:
            parts.append(token)
            if await request.is_disconnected():
                break
            yield f"data: {json.dumps({'delta': token})}\n\n"
        else:
            completed = True
    except llm.LLMRateLimited:
        error = "The assistant provider is rate-limited. Please try again later."
    except llm.LLMTimeout:
        error = "The assistant timed out. Please try again."
    except Exception:
        error = "The assistant is unavailable. Please try again later."
    finally:
        with anyio.CancelScope(shield=True):
            try:
                await asyncio.shield(_finish_reply(
                    stream, sessions, conversation_id, user_id, "".join(parts), completed,
                ))
            except Exception:
                logger.error("Could not persist the assistant reply")
                error = "The assistant reply could not be saved. Please try again."
                completed = False
    if error is not None:
        yield f"event: error\ndata: {json.dumps({'message': error})}\n\n"
    elif completed:
        yield "event: done\ndata: {}\n\n"


@router.post("/conversations/{id}/messages")
async def send_message(
    id: uuid.UUID,
    payload: MessageCreate,
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conversation = await load_own_conversation(db, id, user)
    await db.scalar(select(User.id).where(User.id == user.id).with_for_update())
    now = datetime.utcnow()
    count, oldest = (await db.execute(select(func.count(AiMessage.id), func.min(AiMessage.created_at))
        .join(AiConversation, AiConversation.id == AiMessage.conversation_id)
        .where(AiConversation.user_id == user.id, AiMessage.role == "user",
               AiMessage.created_at > now - timedelta(hours=1)))).one()
    if count >= settings.LLM_RATE_LIMIT_PER_HOUR:
        retry_after = max(1, math.ceil((oldest + timedelta(hours=1) - now).total_seconds())) if oldest else 3600
        raise HTTPException(429, detail={
            "code": "rate_limited", "message": "Hourly assistant message limit reached",
        }, headers={"Retry-After": str(retry_after)})
    db.add(AiMessage(
        conversation_id=conversation.id, role="user", content=payload.content, created_at=now,
    ))
    if not conversation.title:
        conversation.title = payload.content.splitlines()[0][:80]
    conversation.updated_at = now
    await db.flush()
    history = await db.scalars(select(AiMessage)
        .where(AiMessage.conversation_id == conversation.id)
        .order_by(AiMessage.created_at, AiMessage.id))
    prompt = "You are Knowly's helpful assistant. Help users understand and solve their questions."
    question = conversation.question
    if question is not None and can_view(question, user):
        prompt += f"\n\nQuestion title: {question.title}\nQuestion body:\n{question.body}"
    messages = [llm.ChatMessage("system", prompt)]
    messages.extend(llm.ChatMessage(message.role, message.content) for message in history)
    sessions = async_sessionmaker(db.bind, expire_on_commit=False)
    conversation_id, user_id = conversation.id, user.id
    await db.commit()
    return StreamingResponse(
        _stream_reply(request, messages, sessions, conversation_id, user_id),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
