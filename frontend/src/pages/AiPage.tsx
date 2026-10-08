import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import { api, ApiError } from '../lib/api'
import { relativeTime } from '../lib/format'
import type { AiConversation } from '../lib/types'

export default function AiPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [conversations, setConversations] = useState<AiConversation[] | null>(null)
  const [error, setError] = useState('')
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<string[]>([])
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let active = true
    setError('')
    api.get<AiConversation[]>('/ai/conversations').then((data) => {
      if (active) setConversations(data)
    }).catch((err: unknown) => {
      if (active) setError(err instanceof ApiError ? err.message : 'Could not load conversations.')
    })
    return () => { active = false }
  }, [revision])

  async function create() {
    if (creating) return
    setCreating(true)
    setError('')
    try {
      const questionId = params.get('question_id')
      const conversation = await api.post<AiConversation>('/ai/conversations',
        questionId ? { question_id: questionId } : {})
      navigate(`/ai/${conversation.id}`)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create conversation.')
    } finally {
      setCreating(false)
    }
  }

  async function remove(conversation: AiConversation) {
    if (!window.confirm('Delete this conversation and all its messages?')) return
    setDeleting((ids) => [...ids, conversation.id])
    setError('')
    try {
      await api.del(`/ai/conversations/${conversation.id}`)
      setConversations((rows) => rows?.filter((row) => row.id !== conversation.id) ?? null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete conversation.')
    } finally {
      setDeleting((ids) => ids.filter((id) => id !== conversation.id))
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">AI assistant</h1>
        <button type="button" onClick={() => void create()} disabled={creating}
          className="rounded-md bg-accent px-4 py-2 text-sm text-white disabled:opacity-50">
          {creating ? 'Creating…' : 'New conversation'}
        </button>
      </div>
      {error && <p role="alert" className="text-sm text-red-700">{error}{' '}
        <button type="button" onClick={() => setRevision((value) => value + 1)} className="underline">Retry loading</button>
      </p>}
      {conversations === null && !error && <p className="text-sm text-slate-500">Loading…</p>}
      {conversations?.length === 0 && <p className="rounded-lg border p-6 text-slate-500">
        No conversations yet. Start a conversation to get help with your questions.
      </p>}
      <ul className="divide-y rounded-lg border empty:hidden">
        {conversations?.map((conversation) => (
          <li key={conversation.id} className="flex items-center gap-3 p-4">
            <div className="min-w-0 flex-1 space-y-1">
              <Link to={`/ai/${conversation.id}`} className="block truncate font-medium text-accent hover:underline">
                {conversation.title || 'New conversation'}
              </Link>
              {conversation.question && <Link to={`/questions/${conversation.question.id}`}
                className="block truncate text-sm text-slate-600 hover:underline">{conversation.question.title}</Link>}
              <time dateTime={conversation.updated_at} className="text-xs text-slate-500">{relativeTime(conversation.updated_at)}</time>
            </div>
            <button type="button" onClick={() => void remove(conversation)} disabled={deleting.includes(conversation.id)}
              aria-label={`Delete ${conversation.title || 'conversation'}`}
              className="text-sm text-red-700 hover:underline disabled:opacity-50">Delete</button>
          </li>
        ))}
      </ul>
    </div>
  )
}
