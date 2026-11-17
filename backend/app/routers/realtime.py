from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.db.session import AsyncSessionLocal
from app.services.session import get_optional_session

router = APIRouter(tags=["realtime"])

@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    async with AsyncSessionLocal() as db:
        session = await get_optional_session(websocket, db)
    if session is None:
        await websocket.close(code=1008)
        return
    user_id = session.user_id
    await websocket.accept()
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass