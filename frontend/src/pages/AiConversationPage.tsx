import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate, useOutletContext, useParams } from 'react-router-dom'

import NavIcon from '../components/NavIcon'
import type { AiOutletContext } from './AiPage'
import MarkdownBody from '../components/MarkdownBody'
import { api, ApiError } from '../lib/api'
import { readAiStream } from '../lib/aiStream'
import type { AiConversationDetail } from '../lib/types'

export default function AiConversationPage() {
  const { conversationId = '' } = useParams()
  return <Chat key={conversationId} id={conversationId} />
}

function Chat({ id }: { id: string }) {
  const navigate = useNavigate()
  const { refreshList } = useOutletContext<AiOutletContext>()
  const [conversation, setConversation] = useState<AiConversationDetail | null>(null)
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [sending, setSending] = useState(false)
  const [pending, setPending] = useState<string | null>(null)
  const [reply, setReply] = useState('')
  const [retryAt, setRetryAt] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [revision, setRevision] = useState(0)
  const controller = useRef<AbortController | null>(null)
  const active = useRef(false)
  const bottom = useRef<HTMLDivElement>(null)
  const cooldown = Math.max(0, Math.ceil((retryAt - now) / 1000))

  useEffect(() => {
    active.current = true
    let current = true
    api.get<AiConversationDetail>(`/ai/conversations/${id}`).then((data) => {
      if (current) { setConversation(data); setError('') }
    }).catch((err: unknown) => {
      if (current) setError(err instanceof ApiError ? err.message : 'Could not load conversation.')
    })
    return () => { current = false; active.current = false; controller.current?.abort() }
  }, [id, revision])

  useEffect(() => {
    if (!retryAt) return
    const timer = window.setInterval(() => {
      const value = Date.now()
      setNow(value)
      if (value >= retryAt) setRetryAt(0)
    }, 250)
    return () => window.clearInterval(timer)
  }, [retryAt])

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' })
  }, [conversation, pending, reply])

  async function send(event: FormEvent) {
    event.preventDefault()
    const draft = text
    const content = draft.trim()
    if (!conversation || controller.current || Date.now() < retryAt || !content || content.length > 8000) return
    const request = new AbortController()
    controller.current = request
    setSending(true)
    setPending(content)
    setReply('')
    setText('')
    setError('')
    try {
      const response = await fetch(`/api/ai/conversations/${id}/messages`, {
        method: 'POST', credentials: 'include', signal: request.signal,
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }),
      })
      if (!response.ok) {
        if (response.status === 429) {
          const header = response.headers.get('Retry-After')
          const seconds = header ? Number(header) : NaN
          const deadline = Number.isFinite(seconds) ? Date.now() + Math.max(1, seconds) * 1000
            : Math.max(Date.now() + 1000, header ? Date.parse(header) || Date.now() + 60000 : Date.now() + 60000)
          if (active.current) { setRetryAt(deadline); setNow(Date.now()) }
        }
        const body = await response.json().catch(() => null)
        throw new Error(body?.error?.message || 'Could not send message. Please try again.')
      }
      if (!response.body) throw new Error('Streaming is unavailable. Please try again.')
      await readAiStream(response.body, (delta) => {
        if (active.current) setReply((value) => value + delta)
      })
    } catch (err) {
      if (active.current && !request.signal.aborted) {
        setText(draft)
        setError(err instanceof Error ? err.message : 'Could not send message. Please try again.')
      }
    } finally {
      if (active.current) {
        try {
          const attempts = request.signal.aborted ? 3 : 1
          let saved: AiConversationDetail | null = null
          for (let attempt = 0; attempt < attempts; attempt++) {
            if (request.signal.aborted) await new Promise((resolve) => window.setTimeout(resolve, 250 * (attempt + 1)))
            if (!active.current) break
            saved = await api.get<AiConversationDetail>(`/ai/conversations/${id}`)
          }
          if (active.current && saved) { setConversation(saved); setPending(null); setReply(''); refreshList() }
        } catch {
          if (active.current) setError((previous) => `${previous ? `${previous} ` : ''}Could not reload saved messages. Retry loading before sending again.`)
        }
        if (active.current) setSending(false)
      }
      controller.current = null
    }
  }

  function useAsAnswer(content: string) {
    if (!conversation?.question) return
    navigate(`/questions/${conversation.question.id}`, {
      state: { prefillBody: content, fromConversationId: id, isAiAssisted: true },
    })
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      event.currentTarget.form?.requestSubmit()
    }
  }

  const canSend = Boolean(conversation) && !sending && cooldown === 0 && text.trim().length > 0 && pending === null

  return (
    <>
      <header className="flex items-center gap-2 border-b border-line bg-surface px-2 py-2.5 lg:px-6 lg:py-3.5">
        <Link to="/ai" className="ah-icon-btn lg:hidden" aria-label="All conversations">
          <NavIcon name="back" strokeWidth={2} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[18px] font-bold tracking-[-0.02em] text-ink lg:text-[20px]">
            {conversation?.title || 'AI conversation'}
          </h1>
          {conversation?.question && (
            <Link to={`/questions/${conversation.question.id}`} className="ah-link block truncate text-body-sm">
              On: {conversation.question.title}
            </Link>
          )}
        </div>
      </header>

      <div className="relative min-h-0 flex-1 overflow-y-auto px-4 py-5 lg:px-6">
        <div className="mx-auto flex max-w-[720px] flex-col gap-4">
          {error && (
            <p role="alert" className="ah-alert">
              {error}{' '}
              {!sending && (
                <button type="button" onClick={() => { setPending(null); setReply(''); setRevision((value) => value + 1) }}
                  className="font-semibold underline">Retry loading</button>
              )}
            </p>
          )}
          {!conversation && !error && (
            <div role="status" aria-label="Loading conversation" className="space-y-4">
              <div className="ah-skeleton ml-auto h-10 w-2/3 rounded-2xl" />
              <div className="ah-skeleton h-24 w-5/6 rounded-2xl bg-ai-skeleton" />
            </div>
          )}
          {conversation?.messages.length === 0 && pending === null && (
            <div className="py-10 text-center">
              <span className="mx-auto mb-4 inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-ai-tint text-ai">
                <NavIcon name="ai" size={24} />
              </span>
              <p className="ah-empty-title">How can I help?</p>
              <p className="ah-empty-text">
                {conversation.question
                  ? 'Ask for help drafting an answer to the linked question.'
                  : 'Ask a question to start the conversation.'}
              </p>
            </div>
          )}
          <ul className="flex flex-col gap-4">
            {conversation?.messages.map((message) => (
              message.role === 'user' ? (
                <li key={message.id} className="flex justify-end">
                  <div className="ah-bubble-mine max-w-[85%] text-body-md">
                    <span className="sr-only">You: </span>
                    <p className="whitespace-pre-wrap break-words">{message.content}</p>
                  </div>
                </li>
              ) : (
                <li key={message.id} className="min-w-0 rounded-card border border-ai-line bg-surface px-4 py-3.5">
                  <p className="mb-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.02em] text-ai">Assistant</p>
                  <MarkdownBody markdown={message.content} compact />
                  {message.content && conversation.question && !sending && (
                    <button type="button" onClick={() => useAsAnswer(message.content)}
                      className="mt-3 inline-flex min-h-[32px] items-center text-body-sm font-semibold text-ai hover:underline">
                      Use this as my answer →
                    </button>
                  )}
                </li>
              )
            ))}
            {pending !== null && <>
              <li className="flex justify-end">
                <div className="ah-bubble-mine max-w-[85%] text-body-md">
                  <span className="sr-only">You: </span>
                  <p className="whitespace-pre-wrap break-words">{pending}</p>
                </div>
              </li>
              <li className="min-w-0 rounded-card border border-ai-line bg-surface px-4 py-3.5" aria-live="polite">
                <p className="mb-1.5 font-mono text-[11px] font-bold uppercase tracking-[0.02em] text-ai">Assistant</p>
                {reply ? <MarkdownBody markdown={reply} compact /> : (
                  <div>
                    <p className="text-body-sm text-ink-muted">{sending ? 'Thinking…' : 'Waiting for saved messages…'}</p>
                    <div className="ah-skeleton mt-2.5 h-3 w-3/5 bg-ai-skeleton" />
                  </div>
                )}
              </li>
            </>}
          </ul>
          <div ref={bottom} />
        </div>
      </div>

      <form onSubmit={(event) => void send(event)} className="border-t border-line bg-canvas-main px-3 pb-3 pt-3 lg:px-6 lg:pb-4">
        <div className="mx-auto max-w-[720px]">
          {cooldown > 0 && <p role="status" className="ah-alert-warn mb-2">Hourly limit reached. You can send again in {cooldown}s.</p>}
          <div className="ah-composer">
            <label htmlFor="ai-message" className="sr-only">Your message</label>
            <textarea id="ai-message" value={text} onChange={(event) => setText(event.target.value)} onKeyDown={handleKeyDown}
              disabled={sending || !conversation} maxLength={8000} rows={1} placeholder="Ask the assistant…" />
            {sending ? (
              <button type="button" onClick={() => controller.current?.abort()} className="ah-btn bg-tag-ink text-white hover:opacity-90">Stop</button>
            ) : (
              <button type="submit" disabled={!canSend} className="ah-btn-ai-solid">Send</button>
            )}
          </div>
          <p className="mt-2 text-center text-meta text-ink-faint">
            AI replies can be wrong. Check them before you rely on them.
          </p>
        </div>
      </form>
    </>
  )
}
