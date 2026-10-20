import { useCallback, useEffect, useRef } from 'react'

import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import { usePolling } from './usePolling'

const INTERVAL_MS = 30_000

export function useHeartbeat(): void {
  const { user } = useAuth()
  const userId = user?.id
  const lastAttemptAt = useRef(0)

  const beat = useCallback(() => {
    if (!userId || document.hidden) return

    const now = Date.now()
    if (now - lastAttemptAt.current < INTERVAL_MS) return

    lastAttemptAt.current = now

    void api.post('/users/me/heartbeat').catch(() => {
    })
  }, [userId])

  useEffect(() => {
    lastAttemptAt.current = 0
    beat()
  }, [beat])

  usePolling(beat, INTERVAL_MS, Boolean(userId))
}