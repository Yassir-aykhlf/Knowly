from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.user import User
from app.schemas.friend import FriendRequestCreate, FriendRequestOut
from app.services.auth import get_current_user
from app.services.friends import send_friend_request

router = APIRouter(prefix="/friends", tags=["friends"])


@router.post("/request", response_model=FriendRequestOut, status_code=201)
async def request_friend(
    payload: FriendRequestCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FriendRequestOut:
    friendship = await send_friend_request(db, user.id, payload.addressee_id)
    return friendship