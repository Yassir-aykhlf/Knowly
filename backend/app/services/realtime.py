import uuid
from fastapi import WebSocket

connections: dict[uuid.UUID, set[WebSocket]] = {}


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