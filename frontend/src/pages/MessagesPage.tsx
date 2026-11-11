import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useMatch } from 'react-router-dom'

import Avatar from '../components/Avatar'
import NavIcon from '../components/NavIcon'
import { EmptyState, ErrorState, SkeletonRows } from '../components/StateBlocks'
import { usePolling } from '../hooks/usePolling'
import { api, ApiError } from '../lib/api'
import { relativeTime } from '../lib/format'
import type { Conversation, Friend } from '../lib/types'

export type MessagesOutletContext = {
  conversations: Conversation[] | null
  // Presence is only known for friends; undefined means "unknown".
  onlineById: Record<string, boolean>
  refreshList: () => void
}

export default function MessagesPage() {
  const activeId = useMatch('/messages/:userId')?.params.userId
  const [conversations, setConversations] = useState<Conversation[] | null>(null)
  const [onlineById, setOnlineById] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState('')

  const fetchConversations = useCallback(async () => {
    try {
      const data = await api.get<Conversation[]>('/messages/conversations')
      setConversations(data)
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load conversations.')
    }
  }, [])

  const fetchPresence = useCallback(async () => {
    try {
      const friends = await api.get<Friend[]>('/friends')
      setOnlineById(Object.fromEntries(friends.map((f) => [f.user.id, f.online])))
    } catch {
      // Presence dots are optional; the list works without them.
    }
  }, [])

  const refreshList = useCallback(() => {
    void fetchConversations()
  }, [fetchConversations])

  useEffect(() => {
    void fetchConversations()
    void fetchPresence()
  }, [fetchConversations, fetchPresence])

  usePolling(() => {
    void fetchConversations()
    void fetchPresence()
  }, 30000)

  const context = useMemo<MessagesOutletContext>(
    () => ({ conversations, onlineById, refreshList }),
    [conversations, onlineById, refreshList],
  )

  const needle = filter.trim().toLowerCase()
  const shown = conversations?.filter((c) => c.user.username.toLowerCase().includes(needle)) ?? null

  return (
    <div className="flex min-h-0 flex-1">
      <section
        aria-label="Conversations"
        className={`${activeId ? 'hidden lg:flex' : 'flex'} min-h-0 w-full flex-col border-line bg-surface lg:w-[320px] lg:shrink-0 lg:border-r`}
      >
        <div className="px-4 pb-3 pt-5">
          <h1 className="font-display text-[22px] font-bold tracking-[-0.02em] text-ink">Messages</h1>
          <div className="relative mt-3">
            <NavIcon name="search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-dim" />
            <input
              type="search"
              value={filter}
              onChange={(event) => setFilter(event.target.value)}
              placeholder="Find a person"
              aria-label="Find a person"
              className="h-11 w-full rounded-btn border border-transparent bg-fill-subtle pl-9 pr-3 text-base text-ink placeholder:text-ink-dim focus:border-accent focus:bg-surface focus:outline-none lg:h-10 lg:text-body"
            />
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {error && (
            <div className="px-2">
              <ErrorState title="Couldn't load messages" message={error} onRetry={refreshList} />
            </div>
          )}
          {conversations === null && !error && <SkeletonRows count={4} />}

          {conversations !== null && conversations.length === 0 && (
            <div className="px-2 pt-2">
              <EmptyState
                title="No conversations yet"
                action={<Link to="/users" className="ah-btn-secondary ah-btn-sm">Find people</Link>}
              >
                Open someone&apos;s profile and choose Message to start one.
              </EmptyState>
            </div>
          )}

          {shown !== null && conversations !== null && conversations.length > 0 && shown.length === 0 && (
            <p className="px-3 py-4 text-body text-ink-muted">No conversation matches “{filter.trim()}”.</p>
          )}

          <ul className="space-y-0.5">
            {shown?.map((c) => {
              const active = c.user.id === activeId
              const unread = c.unread_count > 0
              return (
                <li key={c.user.id}>
                  <Link
                    to={`/messages/${c.user.id}`}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 no-underline transition-colors ${
                      active ? 'bg-accent-tint' : 'hover:bg-line4'
                    }`}
                  >
                    <Avatar user={c.user} size={40} online={onlineById[c.user.id]} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`truncate text-body text-ink ${unread ? 'font-bold' : 'font-semibold'}`}>
                          {c.user.username}
                        </span>
                        <span className="shrink-0 text-meta text-ink-ghost">{relativeTime(c.last_message_at)}</span>
                      </span>
                      <span className="flex items-center justify-between gap-2">
                        <span className={`truncate text-body-sm ${unread ? 'font-medium text-ink' : 'text-ink-faint'}`}>
                          {c.last_message_from_me ? 'You: ' : ''}
                          {c.last_message}
                        </span>
                        {unread && (
                          <span className="ah-count shrink-0">
                            {c.unread_count}
                            <span className="sr-only"> unread</span>
                          </span>
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      </section>

      <section
        aria-label="Conversation"
        className={`${activeId ? 'flex' : 'hidden lg:flex'} min-h-0 min-w-0 flex-1 flex-col`}
      >
        <Outlet context={context} />
      </section>
    </div>
  )
}

export function MessagesEmptyPane() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-accent-tint text-accent-dark">
          <NavIcon name="messages" size={24} />
        </span>
        <p className="ah-empty-title">Pick a conversation</p>
        <p className="ah-empty-text">Choose someone from the list to read and send messages.</p>
      </div>
    </div>
  )
}
