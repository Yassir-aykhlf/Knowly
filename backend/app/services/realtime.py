import uuid
import asyncio
from fastapi import WebSocket
from sqlalchemy import event
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession

connections: dict[uuid.UUID, set[WebSocket]] = {}

def send_after_commit(db: AsyncSession, user_id: uuid.UUID, message: dict) -> None:
    pending = db.info.setdefault("realtime", [])
    if (user_id, message) not in pending:
        pending.append((user_id, message))

_tasks = set()

@event.listens_for(Session, "after_commit")
def _send_pending(session: Session) -> None:
    for user_id, message in session.info.pop("realtime", []):
        task = asyncio.get_running_loop().create_task(send_to_user(user_id, message))
        _task.add(task)
        task.add_done_callback(_tasks.discard)

@event.listens_for(Session, "after_rollback")
def _drop_pending(session: Session) -> None:
    session.info.pop("realtime", None)

def connect(user_id: uuid.UUID, websocket: WebSocket) -> None:
    connections.setdefault(user_id, set()).add(websocket)

def disconnect(user_id: uuid.UUID, websocket: WebSocket) -> None:
    sockets = connections.get(user_id)
    if sockets is None:
        return
    sockets.discard(websocket)
    if not sockets:
        del connections[user_id]


async def send_to_user(user_id: uuid.UUID, message: dict) -> None:
    for websocket in list(connections.get(user_id, ())):
        try:
            await websocket.send_json(message)
        except Exception:
            disconnect(user_id, websocket)