import { Link } from 'react-router-dom'

import { api, ApiError } from '../lib/api'
import { relativeTime } from '../lib/format'
import type { Friend, PendingRequest } from '../lib/types'
import { useToast } from '../contexts/ToastContext'
import Avatar from './Avatar'
import { EmptyState, ErrorState, SkeletonRows } from './StateBlocks'

type Props = {
  friends: Friend[] | null
  pending: PendingRequest[] | null
  setFriends: (friends: Friend[]) => void
  setPending: (pending: PendingRequest[]) => void
  refetchFriends: () => void
  friendsError?: string | null
  pendingError?: string | null
  refetchPending: () => void
}

export default function FriendsList({
  friends,
  pending,
  setFriends,
  setPending,
  refetchFriends,
  friendsError,
  pendingError,
  refetchPending,
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
    <div className="ah-page max-w-[840px]">
      <h1 className="ah-h1">Friends</h1>
      <p className="ah-lead mt-2.5">Answer requests, see who&apos;s online and start a conversation.</p>

      <section className="mt-7" aria-labelledby="requests-heading">
        <h2 id="requests-heading" className="ah-overline mb-2.5">
          Requests{pending !== null ? ` · ${pending.length}` : ''}
        </h2>

        {pendingError && <ErrorState title="Couldn't load requests" message={pendingError} onRetry={refetchPending} />}
        {pending === null && !pendingError && <div className="ah-card"><SkeletonRows count={1} /></div>}

        {pending !== null && pending.length === 0 && (
          <EmptyState title="No pending requests">New friend requests will show up here.</EmptyState>
        )}

        {pending !== null && pending.length > 0 && (
          <ul className="space-y-3">
            {pending.map((p) => (
              <li key={p.friendship_id} className="ah-card flex flex-wrap items-center gap-3 p-4">
                <Avatar user={p.requester} size={40} />
                <div className="min-w-0 flex-1 basis-32">
                  <Link to={`/users/${p.requester.id}`} className="block truncate text-[15px] font-semibold text-ink hover:text-accent-dark">
                    {p.requester.username}
                  </Link>
                  <p className="text-meta text-ink-faint">Sent {relativeTime(p.created_at)}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void respond(p.friendship_id, 'accept')}
                    className="ah-btn-primary ah-btn-sm"
                  >
                    Accept
                  </button>
                  <button
                    type="button"
                    onClick={() => void respond(p.friendship_id, 'reject')}
                    className="ah-btn-secondary ah-btn-sm"
                  >
                    Decline
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8" aria-labelledby="friends-heading">
        <h2 id="friends-heading" className="ah-overline mb-2.5">
          Friends{friends !== null ? ` · ${friends.length}` : ''}
        </h2>

        {friendsError && <ErrorState title="Couldn't load friends" message={friendsError} onRetry={refetchFriends} />}
        {friends === null && !friendsError && <div className="ah-card"><SkeletonRows count={3} /></div>}

        {friends !== null && friends.length === 0 && (
          <EmptyState
            title="No friends yet"
            action={<Link to="/users" className="ah-btn-secondary ah-btn-sm">Find people</Link>}
          >
            Add people whose answers you trust.
          </EmptyState>
        )}

        {friends !== null && friends.length > 0 && (
          <ul className="ah-card divide-y divide-line4">
            {friends.map((f) => (
              <li key={f.friendship_id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Avatar user={f.user} size={40} online={f.online} />
                <div className="min-w-0 flex-1 basis-32">
                  <Link to={`/users/${f.user.id}`} className="block truncate text-[15px] font-semibold text-ink hover:text-accent-dark">
                    {f.user.username}
                  </Link>
                  <p className={`text-meta ${f.online ? 'font-medium text-accent-dark' : 'text-ink-faint'}`} aria-hidden="true">
                    {f.online ? 'Online' : 'Offline'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <Link to={`/messages/${f.user.id}`} className="ah-btn-secondary ah-btn-sm">
                    Message
                  </Link>
                  <button
                    type="button"
                    onClick={() => void remove(f.friendship_id)}
                    className="ah-btn-ghost ah-btn-sm"
                    aria-label={`Remove ${f.user.username} from friends`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
