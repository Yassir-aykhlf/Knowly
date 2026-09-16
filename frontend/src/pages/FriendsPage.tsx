
import { useCallback, useEffect, useState } from 'react'

import FriendsList from '../components/FriendsList'
import { usePolling } from '../hooks/usePolling'
import { api } from '../lib/api'
import type { Friend, PendingRequest } from '../lib/types'

export default function FriendsPage() {
  const [friends, setFriends] = useState<Friend[] | null>(null)
  const [pending, setPending] = useState<PendingRequest[] | null>(null)

  const fetchFriends = useCallback(async () => {
    try {
      const data = await api.get<Friend[]>('/friends')
      setFriends(data)
    } catch {
      setFriends([])
    }
  }, [])

  const fetchPending = useCallback(async () => {
    try {
      const data = await api.get<PendingRequest[]>('/friends/pending')
      setPending(data)
    } catch {
      setPending([])
    }
  }, [])

  useEffect(() => {
    void fetchFriends()
    void fetchPending()
  }, [fetchFriends, fetchPending])


  usePolling(() => {
    void fetchFriends()
    void fetchPending()
  }, 30000)

  return (
    <FriendsList
      friends={friends}
      pending={pending}
      setFriends={setFriends}
      setPending={setPending}
      refetchFriends={() => void fetchFriends()}
    />
  )
}