import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useOutletContext, useParams } from 'react-router-dom'

import Avatar from '../components/Avatar'
import NavIcon from '../components/NavIcon'
import type { MessagesOutletContext } from './MessagesPage'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { usePolling } from '../hooks/usePolling'
import { api, ApiError } from '../lib/api'
import type { Message, Paginated, Author, UserProfile } from '../lib/types'

const PAGE_SIZE = 30
const SCROLL_BOTTOM_THRESHOLD = 48

export default function ConversationPage() {
  const { userId } = useParams<{ userId: string }>()
  const { user } = useAuth()
  const { showToast } = useToast()
  const { conversations, onlineById, refreshList } = useOutletContext<MessagesOutletContext>()

  const [messagesById, setMessagesById] = useState<Record<string, Message>>({})
  const [otherUser, setOtherUser] = useState<Author | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState<number | null>(null)
  const [loadingOlder, setLoadingOlder] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)
  const firstLoadRef = useRef(true)

  const messages = useMemo(
    () =>
      Object.values(messagesById).sort((a, b) => {
        const t = new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
        return t !== 0 ? t : a.id.localeCompare(b.id)
      }),
    [messagesById],
  )

  const mergeMessages = useCallback((incoming: Message[]) => {
    setMessagesById((prev) => {
      const next = { ...prev }
      for (const m of incoming) {
        next[m.id] = m
      }
      return next
    })
  }, [])

  const fetchLatest = useCallback(async () => {
    if (!userId) return
    try {
      const data = await api.get<Paginated<Message>>(
        `/messages/${userId}?page=1&limit=${PAGE_SIZE}`,
      )
      mergeMessages(data.items)
      setTotal(data.total)
      setLoaded(true)

      const hasUnreadFromThem = data.items.some(
        (m) => m.sender_id === userId && m.read_at === null,
      )
      if (hasUnreadFromThem || firstLoadRef.current) {
        try {
          await api.put(`/messages/${userId}/read`)
          refreshList()
        } catch {
          // Non-fatal — the badge will just stay stale until next success.
        }
      }
    } catch (err) {
      if (firstLoadRef.current) {
        const message = err instanceof ApiError ? err.message : 'Could not load conversation'
        showToast(message, 'error')
        setLoaded(true)
      }
    } finally {
      firstLoadRef.current = false
    }
  }, [userId, mergeMessages, showToast, refreshList])

  const listed = conversations?.find((c) => c.user.id === userId)?.user ?? null
  const listLoaded = conversations !== null

  useEffect(() => {
    if (listed) {
      setOtherUser(listed)
      return
    }
    setOtherUser((current) => (current?.id === userId ? current : null))
    // Not in the list yet (a brand-new conversation): look the person up.
    if (!userId || !listLoaded) return
    let active = true
    api
      .get<UserProfile>(`/users/${userId}`)
      .then((profile) => {
        if (active) {
          setOtherUser({
            id: profile.id,
            username: profile.username,
            avatar_url: profile.avatar_url,
            is_anonymized: profile.is_anonymized,
          })
        }
      })
      .catch(() => {
        // Fine — we can render without a name if this fails.
      })
    return () => {
      active = false
    }
  }, [userId, listed, listLoaded])

  useEffect(() => {
    setMessagesById({})
    setLoaded(false)
    setPage(1)
    setTotal(null)
    firstLoadRef.current = true
    isAtBottomRef.current = true
    void fetchLatest()
  }, [userId])

  usePolling(() => void fetchLatest(), 5000)

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    isAtBottomRef.current = distanceFromBottom < SCROLL_BOTTOM_THRESHOLD
  }

  useEffect(() => {
    if (isAtBottomRef.current) {
      bottomRef.current?.scrollIntoView({ block: 'end' })
    }
  }, [messages.length])

  // Stay pinned to the newest message when the content's height changes for
  // reasons other than a new message (web fonts loading, the window resizing).
  useEffect(() => {
    const scroller = scrollRef.current
    const content = contentRef.current
    if (!scroller || !content || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (isAtBottomRef.current) scroller.scrollTop = scroller.scrollHeight
    })
    observer.observe(content)
    observer.observe(scroller)
    return () => observer.disconnect()
  }, [])

  async function loadOlder() {
    if (!userId || loadingOlder) return
    if (total !== null && messages.length >= total) return
    setLoadingOlder(true)
    const nextPage = page + 1
    try {
      const el = scrollRef.current
      const previousHeight = el?.scrollHeight ?? 0

      const data = await api.get<Paginated<Message>>(
        `/messages/${userId}?page=${nextPage}&limit=${PAGE_SIZE}`,
      )
      mergeMessages(data.items)
      setTotal(data.total)
      setPage(nextPage)

      requestAnimationFrame(() => {
        if (el) {
          const newHeight = el.scrollHeight
          el.scrollTop = newHeight - previousHeight
        }
      })
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Could not load older messages'
      showToast(message, 'error')
    } finally {
      setLoadingOlder(false)
    }
  }

  async function handleSend() {
    if (!userId || sending) return
    const trimmed = text.trim()
    if (trimmed.length === 0) return
    if (trimmed.length > 4000) {
      showToast('Message is too long (max 4000 characters).', 'error')
      return
    }

    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`
    const optimistic: Message = {
      id: tempId,
      sender_id: user?.id ?? '',
      receiver_id: userId,
      body: trimmed,
      read_at: null,
      created_at: new Date().toISOString(),
    }

    setSending(true)
    isAtBottomRef.current = true
    setMessagesById((prev) => ({ ...prev, [tempId]: optimistic }))
    setText('')

    try {
      const real = await api.post<Message>(`/messages/${userId}`, { body: trimmed })
      setMessagesById((prev) => {
        const next = { ...prev }
        delete next[tempId]
        next[real.id] = real
        return next
      })
      refreshList()
    } catch (err) {
      setMessagesById((prev) => {
        const next = { ...prev }
        delete next[tempId]
        return next
      })
      setText(trimmed)
      const message = err instanceof ApiError ? err.message : 'Message failed to send'
      showToast(message, 'error')
    } finally {
      setSending(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  const canLoadOlder = total !== null && messages.length < total

  const online = userId ? onlineById[userId] : undefined
  let lastDay = ''

  return (
    <>
      <header className="flex items-center gap-2 border-b border-line bg-surface px-2 py-2.5 lg:gap-3 lg:px-6 lg:py-3">
        <Link to="/messages" className="ah-icon-btn lg:hidden" aria-label="All conversations">
          <NavIcon name="back" strokeWidth={2} />
        </Link>
        {otherUser && <Avatar user={otherUser} size={36} online={online} />}
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[18px] font-bold tracking-[-0.02em] text-ink">
            {otherUser?.username ?? 'Conversation'}
          </h1>
          {online !== undefined && (
            <p className={`text-meta ${online ? 'font-medium text-accent-dark' : 'text-ink-faint'}`} aria-hidden="true">
              {online ? 'Online' : 'Offline'}
            </p>
          )}
        </div>
        {otherUser && !otherUser.is_anonymized && (
          <Link to={`/users/${otherUser.id}`} className="ah-btn-secondary ah-btn-sm">
            Profile
          </Link>
        )}
      </header>

      <div ref={scrollRef} onScroll={handleScroll} className="relative min-h-0 flex-1 overflow-y-auto px-4 py-4 lg:px-6">
        <div ref={contentRef} className="mx-auto max-w-[760px]">
          {!loaded && (
            <div role="status" aria-label="Loading messages" className="space-y-3">
              <div className="ah-skeleton h-10 w-1/2 rounded-2xl" />
              <div className="ah-skeleton ml-auto h-10 w-2/5 rounded-2xl" />
              <div className="ah-skeleton h-14 w-3/5 rounded-2xl" />
            </div>
          )}

          {loaded && messages.length === 0 && (
            <div className="py-10 text-center">
              <p className="ah-empty-title">No messages yet</p>
              <p className="ah-empty-text">Say hello. You can message anyone on Knowly.</p>
            </div>
          )}

          {loaded && messages.length > 0 && (
            <>
              {canLoadOlder && (
                <div className="mb-3 text-center">
                  <button
                    type="button"
                    onClick={() => void loadOlder()}
                    disabled={loadingOlder}
                    className="ah-btn-secondary ah-btn-sm"
                  >
                    {loadingOlder ? 'Loading…' : 'Load older messages'}
                  </button>
                </div>
              )}

              <ul className="flex flex-col gap-2">
                {messages.map((m) => {
                  const isMine = m.sender_id === user?.id
                  const isPending = m.id.startsWith('temp-')
                  const sentAt = parseDate(m.created_at)
                  const day = dayLabel(sentAt)
                  const showDay = day !== lastDay
                  lastDay = day
                  return (
                    <li key={m.id} className="flex flex-col">
                      {showDay && (
                        <p className="ah-overline my-3 text-center">{day}</p>
                      )}
                      <div
                        className={`max-w-[78%] text-body-md ${isMine ? 'ah-bubble-mine self-end' : 'ah-bubble-theirs self-start'} ${
                          isPending ? 'opacity-60' : ''
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{m.body}</p>
                        <time dateTime={m.created_at} className="mt-1 block text-right text-[10.5px] leading-none opacity-70">
                          {isPending ? 'Sending…' : sentAt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        </time>
                      </div>
                    </li>
                  )
                })}
              </ul>
            </>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-line bg-canvas-main px-3 pb-3 pt-3 lg:px-6 lg:pb-4">
        <div className="ah-composer mx-auto max-w-[760px]">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            maxLength={4000}
            placeholder="Write a message…"
            aria-label={`Message ${otherUser?.username ?? ''}`.trim()}
          />
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || text.trim().length === 0}
            className="ah-btn-primary"
          >
            Send
          </button>
        </div>
      </div>
    </>
  )
}

function parseDate(iso: string): Date {
  return new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso) ? iso : `${iso}Z`)
}

function dayLabel(date: Date): string {
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)
  if (date.toDateString() === today.toDateString()) return 'Today'
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}
