import { useEffect } from 'react'

import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import { usePolling } from './usePolling'

export function useHeartbeat() {
  const { user } = useAuth()

  useEffect(() => {
    if (user && !document.hidden) {
      void api.post('/users/me/heartbeat').catch(() => {})
    }
  }, [user])

  usePolling(
    () => {
      void api.post('/users/me/heartbeat').catch(() => {})
    },
    30_000,
    !!user,
  )
}