import { useCallback, useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { api } from '../lib/api'
import type { Conversation, PendingRequest, UnreadCount } from '../lib/types'
import { usePolling } from './usePolling'

export type NavCounts = {
  notifications: number
  friends: number
  messages: number
}

// Badge counts for the sidebar. Refreshed on a 30s poll and on every
// navigation, so reading a thread or the inbox clears its badge promptly.
export function useNavCounts(): NavCounts {
  const { pathname } = useLocation()
  const [counts, setCounts] = useState<NavCounts>({ notifications: 0, friends: 0, messages: 0 })

  const refresh = useCallback(async () => {
    const [notifications, friends, messages] = await Promise.all([
      api.get<UnreadCount>('/notifications/unread-count').then((d) => d.count).catch(() => null),
      api.get<PendingRequest[]>('/friends/pending').then((d) => d.length).catch(() => null),
      api
        .get<Conversation[]>('/messages/conversations')
        .then((d) => d.reduce((sum, c) => sum + c.unread_count, 0))
        .catch(() => null),
    ])
    setCounts((prev) => ({
      notifications: notifications ?? prev.notifications,
      friends: friends ?? prev.friends,
      messages: messages ?? prev.messages,
    }))
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh, pathname])

  usePolling(refresh, 30000)

  return counts
}
