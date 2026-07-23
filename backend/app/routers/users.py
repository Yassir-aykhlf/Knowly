# from fastapi import APIRouter

# router = APIRouter(prefix="/users", tags=["users"])

from fastapi import APIRouter, Depends

from app.models.user import User
from app.schemas.user import UserMeOut
from app.services.auth import get_current_user

router = APIRouter(prefix="/users", tags=["users"])


# Keep literal routes above /{user_id} routes.
@router.get("/me", response_model=UserMeOut)
async def get_me(
    user: User = Depends(get_current_user),
) -> UserMeOut:
    return UserMeOut.from_user(user)
