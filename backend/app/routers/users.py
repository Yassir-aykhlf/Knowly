from fastapi import APIRouter, Depends


from app.models.user import User
from app.services.auth import get_current_user


router = APIRouter(prefix="/users", tags=["users"])

@router.get("/me")
async def get_me(
    user: User = Depends(get_current_user),
):
    return {"id": str(user.id)}
