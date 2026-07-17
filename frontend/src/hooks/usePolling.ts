import { useEffect, useRef } from 'react'

// Calls `fn` every `intervalMs` while enabled. Pauses when the tab is hidden and
// fires once immediately when it becomes visible again, so a returning user sees
// fresh data without waiting a whole interval. The first fetch is the caller's
// job; this only schedules the repeats.
export function usePolling(
  fn: () => void | Promise<void>,
  intervalMs: number,
  enabled = true,
): void {
  const saved = useRef(fn)
  useEffect(() => {
    saved.current = fn
  })

  useEffect(() => {
    if (!enabled) return
    let timer: ReturnType<typeof setInterval> | null = null
    const tick = () => {
      void saved.current()
    }
    const start = () => {
      if (timer === null) timer = setInterval(tick, intervalMs)
    }
    const stop = () => {
      if (timer !== null) {
        clearInterval(timer)
        timer = null
      }
    }
    const onVisibility = () => {
      if (document.hidden) stop()
      else {
        tick()
        start()
      }
    }
    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stop()
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [intervalMs, enabled])
}
