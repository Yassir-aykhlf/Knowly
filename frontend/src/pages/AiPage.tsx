import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, Outlet, useMatch, useNavigate, useSearchParams } from 'react-router-dom'

import NavIcon from '../components/NavIcon'
import { EmptyState, SkeletonRows } from '../components/StateBlocks'
import { api, ApiError } from '../lib/api'
import { relativeTime } from '../lib/format'
import type { AiConversation } from '../lib/types'

export type AiOutletContext = { refreshList: () => void }

export default function AiPage() {
  const navigate = useNavigate()
  const activeId = useMatch('/ai/:conversationId')?.params.conversationId
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
      if (conversation.id === activeId) navigate('/ai', { replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not delete conversation.')
    } finally {
      setDeleting((ids) => ids.filter((id) => id !== conversation.id))
    }
  }

  const refresh = useCallback(() => setRevision((value) => value + 1), [])
  const context = useMemo<AiOutletContext>(() => ({ refreshList: refresh }), [refresh])

  return (
    <div className="flex min-h-0 flex-1">
      {/* List pane: its own screen on mobile, a fixed column on desktop. */}
      <section
        aria-label="Conversations"
        className={`${activeId ? 'hidden lg:flex' : 'flex'} min-h-0 w-full flex-col border-line bg-surface lg:w-[300px] lg:shrink-0 lg:border-r`}
      >
        <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-5">
          <h1 className="font-display text-[22px] font-bold tracking-[-0.02em] text-ink">AI Assistant</h1>
          <button type="button" onClick={() => void create()} disabled={creating} className="ah-btn-ai-solid ah-btn-sm">
            <NavIcon name="plus" size={16} strokeWidth={2.2} />
            {creating ? 'Creating…' : 'New chat'}
          </button>
        </div>
        {error && (
          <p role="alert" className="ah-alert mx-4 mb-3">
            {error}{' '}
            <button type="button" onClick={refresh} className="font-semibold underline">Retry loading</button>
          </p>
        )}
        <div className="relative min-h-0 flex-1 overflow-y-auto px-2 pb-4">
          {conversations === null && !error && <SkeletonRows count={4} />}
          {conversations?.length === 0 && (
            <div className="px-2 pt-2">
              <EmptyState title="No conversations yet">Start a chat to get help with your questions.</EmptyState>
            </div>
          )}
          <ul className="space-y-0.5">
            {conversations?.map((conversation) => {
              const active = conversation.id === activeId
              return (
                <li key={conversation.id} className="group relative">
                  <Link
                    to={`/ai/${conversation.id}`}
                    aria-current={active ? 'page' : undefined}
                    className={`block rounded-[10px] py-2.5 pl-3 pr-11 no-underline transition-colors ${
                      active ? 'bg-ai-tint' : 'hover:bg-line4'
                    }`}
                  >
                    <span className="block truncate text-body font-semibold text-ink">
                      {conversation.title || 'New conversation'}
                    </span>
                    {conversation.question && (
                      <span className="block truncate text-[12.5px] text-ink-muted">On: {conversation.question.title}</span>
                    )}
                    <time dateTime={conversation.updated_at} className="block text-meta text-ink-ghost">
                      {relativeTime(conversation.updated_at)}
                    </time>
                  </Link>
                  <button
                    type="button"
                    onClick={() => void remove(conversation)}
                    disabled={deleting.includes(conversation.id)}
                    aria-label={`Delete ${conversation.title || 'conversation'}`}
                    title="Delete conversation"
                    className="absolute right-1.5 top-1/2 inline-flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-ink-ghost transition hover:bg-danger-tint hover:text-danger focus-visible:opacity-100 disabled:opacity-40 lg:opacity-0 lg:group-hover:opacity-100"
                  >
                    <NavIcon name="trash" size={16} />
                  </button>
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

export function AiEmptyPane() {
  return (
    <div className="flex flex-1 items-center justify-center p-8">
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-ai-tint text-ai">
          <NavIcon name="ai" size={24} />
        </span>
        <p className="ah-empty-title">Pick a conversation</p>
        <p className="ah-empty-text">Choose a chat from the list, or start a new one to ask the assistant.</p>
      </div>
    </div>
  )
}
