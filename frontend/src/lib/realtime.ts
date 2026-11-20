export type RealtimeEvent = "message" | "notification";
type Listener = () => void;

const RETRY_MS = 3000;

const listeners: Record<RealtimeEvent, Set<Listener>> = {
  message: new Set(),
  notification: new Set(),
};

let socket: WebSocket | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let wanted = false;
let droppedBefore = false;

function runAll() {
    for (const group of Object.values(listeners)) {
        for (const listener of group)
            listener();
    }
}

function open() {
  const protocol = location.protocol === "https:" ? "wss" : "ws";
  socket = new WebSocket(`${protocol}://${location.host}/api/ws`);

  socket.onopen = () => {
    if (droppedBefore) runAll();
    droppedBefore = false;
  };

  socket.onmessage = (event) => {
    const type = JSON.parse(event.data).type as RealtimeEvent;
    for (const listener of listeners[type] ?? []) listener();
  };

  socket.onclose = () => {
    socket = null;
    if (!wanted) return;
    droppedBefore = true;
    retryTimer = setTimeout(() => {
      retryTimer = null;
      open();
    }, RETRY_MS);
  };
}

export function connectRealtime() {
  wanted = true;
  if (socket !== null || retryTimer !== null) return;
  open();
}

export function disconnectRealtime() {
  wanted = false;
  droppedBefore = false;
  if (retryTimer !== null) clearTimeout(retryTimer);
  retryTimer = null;
  socket?.close();
}

export function onRealtime(
  type: RealtimeEvent,
  listener: Listener
): () => void {
  listeners[type].add(listener);
  return () => {
    listeners[type].delete(listener);
  };
}
