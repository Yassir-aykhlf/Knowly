import { useEffect, useRef } from "react";

import { onRealtime, type RealtimeEvent } from "../lib/realtime";

export function useRealtime(
  type: RealtimeEvent,
  fn: () => void | Promise<void>
): void {
  const saved = useRef(fn);
  useEffect(() => {
    saved.current = fn;
  });
  useEffect(() => onRealtime(type, () => void saved.current()), [type]);
}
