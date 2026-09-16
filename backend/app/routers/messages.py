import uuid

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.schemas.message import ConversationOut, MessageCreate, MessageOut, MessagePage
from app.services.auth import get_current_user
from app.services.messages import (
    get_conversation_history,
    list_conversations,
    mark_conversation_read,
    send_message,
)

router = APIRouter(prefix="/messages", tags=["messages"])


@router.get("/conversations", response_model=list[ConversationOut])
async def get_conversations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ConversationOut]:
    return await list_conversations(db, user.id)


@router.post("/{user_id}", response_model=MessageOut, status_code=201)
async def post_message(
    user_id: uuid.UUID,
    payload: MessageCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageOut:
    message = await send_message(db, user.id, user_id, payload.body)
    return message


@router.get("/{user_id}", response_model=MessagePage)
async def get_conversation(
    user_id: uuid.UUID,
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessagePage:
    rows, total = await get_conversation_history(db, user.id, user_id, page, limit)
    return MessagePage(items=rows, total=total, page=page, limit=limit)


@router.put("/{user_id}/read", status_code=204)
async def put_mark_read(
    user_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    await mark_conversation_read(db, user.id, user_id)
    return None