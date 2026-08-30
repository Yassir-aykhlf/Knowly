import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

import Avatar from '../components/Avatar'
import { usePolling } from '../hooks/usePolling'
import { api } from '../lib/api'
import { relativeTime } from '../lib/format'
import type { Conversation } from '../lib/types'

export default function MessagesPage() {
  const [conversations, setConversations] = useState<Conversation[] | null>(null)

  const fetchConversations = useCallback(async () => {
    try {
      const data = await api.get<Conversation[]>('/messages/conversations')
      setConversations(data)
    } catch {
      setConversations([])
    }
  }, [])

  useEffect(() => {
    void fetchConversations()
  }, [fetchConversations])

  usePolling(() => void fetchConversations(), 30000)

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-4 text-xl font-semibold">Messages</h1>

      {conversations === null && <p className="text-sm text-slate-500">Loading...</p>}

      {conversations !== null && conversations.length === 0 && (
        <p className="text-sm text-slate-500">No conversations yet.</p>
      )}

      {conversations !== null && conversations.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {conversations.map((c) => (
            <li key={c.user.id}>
              <Link
                to={`/messages/${c.user.id}`}
                className="flex items-center gap-3 p-3 hover:bg-slate-50"
              >
                <Avatar user={c.user} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium">{c.user.username}</span>
                    <span className="shrink-0 text-xs text-slate-400">
                      {relativeTime(c.last_message_at)}
                    </span>
                  </div>
                  <p className="truncate text-sm text-slate-500">
                    {c.last_message_from_me ? 'You: ' : ''}
                    {c.last_message}
                  </p>
                </div>
                {c.unread_count > 0 && (
                  <span className="ml-2 shrink-0 rounded-full bg-accent px-2 py-0.5 text-xs text-white">
                    {c.unread_count}
                  </span>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}