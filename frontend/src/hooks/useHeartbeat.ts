import { useEffect } from 'react'

import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import { usePolling } from './usePolling'

// While signed in, ping the heartbeat endpoint so the backend can mark us
// "online". The server throttles to once per 30s, so a ~30s interval is plenty.
// (The POST /users/me/heartbeat endpoint is built in task A-10 — until then this
// simply no-ops on the resulting 404.)
export function useHeartbeat() {
  const { user } = useAuth()

  useEffect(() => {
    if (user) void api.post('/users/me/heartbeat').catch(() => {})
  }, [user])

  usePolling(
    () => {
      void api.post('/users/me/heartbeat').catch(() => {})
    },
    30_000,
    !!user,
  )
}
