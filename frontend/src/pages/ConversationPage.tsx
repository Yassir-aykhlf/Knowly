import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'

import Avatar from '../components/Avatar'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { usePolling } from '../hooks/usePolling'
import { api, ApiError } from '../lib/api'
import { relativeTime } from '../lib/format'
import type { Message, Paginated, Author } from '../lib/types'

const PAGE_SIZE = 30
const SCROLL_BOTTOM_THRESHOLD = 48

export default function ConversationPage() {
  const { userId } = useParams<{ userId: string }>()
  const { user } = useAuth()
  const { showToast } = useToast()

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
  }, [userId, mergeMessages, showToast])

  useEffect(() => {
    if (!userId) return
    let active = true
    api
      .get<{ user: Author }[]>('/messages/conversations')
      .then((convos) => {
        if (!active) return
        const match = convos.find((c) => c.user.id === userId)
        if (match) setOtherUser(match.user)
      })
      .catch(() => {
        // Fine — we can render without a name if this fails.
      })
    return () => {
      active = false
    }
  }, [userId])

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

  return (
    <div className="mx-auto flex h-[calc(100vh-4rem)] max-w-2xl flex-col px-4 py-4">
      <div className="mb-3 flex items-center gap-3 border-b pb-3">
        {otherUser && <Avatar user={otherUser} size={36} />}
        <h1 className="text-lg font-semibold">{otherUser?.username ?? 'Conversation'}</h1>
      </div>

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
        {!loaded && <p className="text-sm text-slate-500">Loading...</p>}

        {loaded && messages.length === 0 && (
          <p className="text-sm text-slate-500">
            No messages yet. Say hello — you can message anyone on Knowly.
          </p>
        )}

        {loaded && messages.length > 0 && (
          <>
            {canLoadOlder && (
              <div className="mb-3 text-center">
                <button
                  type="button"
                  onClick={() => void loadOlder()}
                  disabled={loadingOlder}
                  className="text-sm text-accent underline disabled:text-slate-400"
                >
                  {loadingOlder ? 'Loading...' : 'Load older'}
                </button>
              </div>
            )}

            <ul className="flex flex-col gap-2">
              {messages.map((m) => {
                const isMine = m.sender_id === user?.id
                const isPending = m.id.startsWith('temp-')
                return (
                  <li key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[75%] rounded-lg px-3 py-2 text-sm ${
                        isMine ? 'bg-accent text-white' : 'bg-slate-100 text-slate-900'
                      } ${isPending ? 'opacity-60' : ''}`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.body}</p>
                      <span
                        className={`mt-1 block text-right text-[10px] ${
                          isMine ? 'text-white/70' : 'text-slate-400'
                        }`}
                      >
                        {isPending ? 'Sending...' : relativeTime(m.created_at)}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        <div ref={bottomRef} />
      </div>

      <div className="mt-3 flex gap-2 border-t pt-3">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={4000}
          placeholder="Write a message..."
          className="flex-1 resize-none rounded-md border px-3 py-2 text-sm"
        />
        <button
          type="button"
          onClick={() => void handleSend()}
          disabled={sending || text.trim().length === 0}
          className="rounded-md bg-accent px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  )
}