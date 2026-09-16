import uuid

from fastapi import APIRouter, Depends, Response
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.schemas.friend import FriendRequestCreate, FriendRequestOut
from app.services.auth import get_current_user
from app.services.friends import (
    accept_friend_request,
    reject_friend_request,
    remove_friendship,
    send_friend_request,
)

router = APIRouter(prefix="/friends", tags=["friends"])


@router.post("/request", response_model=FriendRequestOut, status_code=201)
async def request_friend(
    payload: FriendRequestCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FriendRequestOut:
    friendship = await send_friend_request(db, user.id, payload.addressee_id)
    return friendship


@router.put("/{friendship_id}/accept", response_model=FriendRequestOut, status_code=200)
async def accept_friend(
    friendship_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FriendRequestOut:
    friendship = await accept_friend_request(db, friendship_id, user.id)
    return friendship


@router.put("/{friendship_id}/reject", response_model=FriendRequestOut, status_code=200)
async def reject_friend(
    friendship_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FriendRequestOut:
    friendship = await reject_friend_request(db, friendship_id, user.id)
    return friendship


@router.delete("/{friendship_id}", status_code=204)
async def delete_friend(
    friendship_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> Response:
    await remove_friendship(db, friendship_id, user.id)
    return Response(status_code=204)