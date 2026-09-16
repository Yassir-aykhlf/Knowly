// AddFriendButton — STUB. Renders nothing for now. Task C-08 implements the
// add / requested / accept-reject / friends button using the profile's
// `friendship` state.
import { useEffect, useState } from 'react'

import { api, ApiError } from '../lib/api'
import type { FriendshipInfo, FriendshipState } from '../lib/types'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

type Props = {
  userId: string
  friendship: FriendshipInfo | null
  isAnonymized?: boolean
}

export default function AddFriendButton({ userId, friendship, isAnonymized = false }: Props) {
  const { user } = useAuth()
  const { showToast } = useToast()

  const [state, setState] = useState<FriendshipState>(friendship?.state ?? 'none')
  const [friendshipId, setFriendshipId] = useState<string | null>(friendship?.id ?? null)

  useEffect(() => {
    setState(friendship?.state ?? 'none')
    setFriendshipId(friendship?.id ?? null)
  }, [userId, friendship?.state, friendship?.id])

  if (isAnonymized) return null
  if (user && user.id === userId) return null

  async function sendRequest() {
    const previousState = state
    setState('request_sent')

    try {
      const created = await api.post<{ id: string; status: string }>('/friends/request', {
        addressee_id: userId,
      })
      setFriendshipId(created.id)
    } catch (err) {
      setState(previousState)
      const message = err instanceof ApiError ? err.message : 'Something went wrong'
      showToast(message, 'error')
    }
  }

  async function accept() {
    if (!friendshipId) return
    const previousState = state
    setState('friends')

    try {
      await api.put(`/friends/${friendshipId}/accept`)
    } catch (err) {
      setState(previousState)
      const message = err instanceof ApiError ? err.message : 'Something went wrong'
      showToast(message, 'error')
    }
  }

  async function reject() {
    if (!friendshipId) return
    const previousState = state
    setState('rejected')

    try {
      await api.put(`/friends/${friendshipId}/reject`)
    } catch (err) {
      setState(previousState)
      const message = err instanceof ApiError ? err.message : 'Something went wrong'
      showToast(message, 'error')
    }
  }

  async function remove() {
    if (!friendshipId) return
    const previousState = state
    const previousId = friendshipId
    setState('none')
    setFriendshipId(null)

    try {
      await api.del(`/friends/${friendshipId}`)
    } catch (err) {
      setState(previousState)
      setFriendshipId(previousId)
      const message = err instanceof ApiError ? err.message : 'Something went wrong'
      showToast(message, 'error')
    }
  }

  switch (state) {
    case 'none':
    case 'rejected':
      return (
        <button
          type="button"
          onClick={() => void sendRequest()}
          className="rounded-md bg-accent px-4 py-2 text-sm text-white"
        >
          Add friend
        </button>
      )

    case 'request_sent':
      return (
        <button
          type="button"
          disabled
          className="rounded-md border px-4 py-2 text-sm text-slate-400"
        >
          Requested
        </button>
      )

    case 'incoming_pending':
      return (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void accept()}
            className="rounded-md bg-accent px-4 py-2 text-sm text-white"
          >
            Accept
          </button>
          <button
            type="button"
            onClick={() => void reject()}
            className="rounded-md border px-4 py-2 text-sm"
          >
            Reject
          </button>
        </div>
      )

    case 'friends':
      return (
        <div className="flex items-center gap-2">
          <span className="rounded-md bg-green-100 px-4 py-2 text-sm text-green-700">
            Friends ✓
          </span>
          <button
            type="button"
            onClick={() => void remove()}
            className="text-sm text-slate-500 underline"
          >
            Remove
          </button>
        </div>
      )

    default:
      return null
  }
}
