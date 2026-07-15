from fastapi import APIRouter

from app.config import settings 

router = APIRouter(prefix="/ai", tags=["ai"])
