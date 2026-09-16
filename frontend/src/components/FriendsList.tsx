import { Link } from 'react-router-dom'

import { api, ApiError } from '../lib/api'
import { relativeTime } from '../lib/format'
import type { Friend, PendingRequest } from '../lib/types'
import { useToast } from '../contexts/ToastContext'
import Avatar from './Avatar'

type Props = {
  friends: Friend[] | null
  pending: PendingRequest[] | null
  setFriends: (friends: Friend[]) => void
  setPending: (pending: PendingRequest[]) => void
  refetchFriends: () => void
}

export default function FriendsList({
  friends,
  pending,
  setFriends,
  setPending,
  refetchFriends,
}: Props) {
  const { showToast } = useToast()

  async function respond(requestId: string, action: 'accept' | 'reject') {
    if (!pending) return
    const previous = pending
    setPending(pending.filter((p) => p.friendship_id !== requestId))

    try {
      await api.put(`/friends/${requestId}/${action}`)
      if (action === 'accept') {
        refetchFriends()
      }
    } catch (err) {
      setPending(previous)
      const message = err instanceof ApiError ? err.message : 'Something went wrong'
      showToast(message, 'error')
    }
  }

  async function remove(friendshipId: string) {
    if (!friends) return
    const previous = friends
    setFriends(friends.filter((f) => f.friendship_id !== friendshipId))

    try {
      await api.del(`/friends/${friendshipId}`)
    } catch (err) {
      setFriends(previous)
      const message = err instanceof ApiError ? err.message : 'Something went wrong'
      showToast(message, 'error')
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <section className="mb-10">
        <h2 className="mb-3 text-lg font-semibold">Requests</h2>

        {pending === null && <p className="text-sm text-slate-500">Loading...</p>}

        {pending !== null && pending.length === 0 && (
          <p className="text-sm text-slate-500">No pending requests.</p>
        )}

        {pending !== null && pending.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {pending.map((p) => (
              <li key={p.friendship_id} className="flex items-center gap-3 p-3">
                <Avatar user={p.requester} size={40} />
                <div className="flex-1">
                  <Link to={`/users/${p.requester.id}`} className="font-medium">
                    {p.requester.username}
                  </Link>
                  <p className="text-xs text-slate-500">{relativeTime(p.created_at)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => void respond(p.friendship_id, 'accept')}
                  className="rounded-md bg-accent px-3 py-1 text-sm text-white"
                >
                  Accept
                </button>
                <button
                  type="button"
                  onClick={() => void respond(p.friendship_id, 'reject')}
                  className="rounded-md border px-3 py-1 text-sm"
                >
                  Reject
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Friends</h2>

        {friends === null && <p className="text-sm text-slate-500">Loading...</p>}

        {friends !== null && friends.length === 0 && (
          <p className="text-sm text-slate-500">No friends yet.</p>
        )}

        {friends !== null && friends.length > 0 && (
          <ul className="divide-y rounded-lg border">
            {friends.map((f) => (
              <li key={f.friendship_id} className="flex items-center gap-3 p-3">
                <span className="relative inline-block">
                  <Avatar user={f.user} size={40} />
                  <span
                    aria-label={f.online ? 'Online' : 'Offline'}
                    className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white ${
                      f.online ? 'bg-green-500' : 'bg-slate-300'
                    }`}
                  />
                </span>
                <div className="flex-1">
                  <Link to={`/users/${f.user.id}`} className="font-medium">
                    {f.user.username}
                  </Link>
                </div>
                <Link to={`/messages/${f.user.id}`} className="text-sm text-accent">
                  Message
                </Link>
                <button
                  type="button"
                  onClick={() => void remove(f.friendship_id)}
                  className="rounded-md border px-3 py-1 text-sm"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}