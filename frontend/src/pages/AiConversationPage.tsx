import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'

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
          if (active.current && saved) { setConversation(saved); setPending(null); setReply('') }
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

  return (
    <div className="mx-auto flex h-[calc(100dvh-4rem)] max-w-3xl flex-col gap-4 px-4 py-4">
      <header className="space-y-2 border-b pb-3">
        <Link to="/ai" className="text-sm text-accent hover:underline">← All conversations</Link>
        <h1 className="truncate text-xl font-semibold">{conversation?.title || 'AI conversation'}</h1>
        {conversation?.question && <Link to={`/questions/${conversation.question.id}`}
          className="block truncate text-sm text-accent hover:underline">{conversation.question.title}</Link>}
      </header>
      {error && <p role="alert" className="text-sm text-red-700">{error}{' '}
        {!sending && <button type="button" onClick={() => { setPending(null); setReply(''); setRevision((value) => value + 1) }}
          className="underline">Retry loading</button>}
      </p>}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {!conversation && !error && <p className="text-sm text-slate-500">Loading…</p>}
        {conversation?.messages.length === 0 && pending === null && <p className="text-slate-500">Ask a question to start the conversation.</p>}
        <ul className="space-y-4">
          {conversation?.messages.map((message) => (
            <li key={message.id} className={`rounded-lg p-4 ${message.role === 'user' ? 'ml-6 bg-accent text-white' : 'mr-6 bg-slate-100'}`}>
              <p className="mb-2 text-xs font-semibold">{message.role === 'user' ? 'You' : 'Assistant'}</p>
              {message.role === 'assistant' ? <MarkdownBody markdown={message.content} />
                : <p className="whitespace-pre-wrap break-words">{message.content}</p>}
              {message.role === 'assistant' && message.content && conversation.question && !sending &&
                <button type="button" onClick={() => useAsAnswer(message.content)} className="mt-3 text-sm text-accent hover:underline">Use this as my answer</button>}
            </li>
          ))}
          {pending !== null && <>
            <li className="ml-6 rounded-lg bg-accent p-4 text-white"><p className="mb-2 text-xs font-semibold">You</p>
              <p className="whitespace-pre-wrap break-words">{pending}</p></li>
            <li className="mr-6 rounded-lg bg-slate-100 p-4"><p className="mb-2 text-xs font-semibold">Assistant</p>
              {reply ? <MarkdownBody markdown={reply} /> : <p className="text-sm text-slate-500">{sending ? 'Thinking…' : 'Waiting for saved messages…'}</p>}
            </li>
          </>}
        </ul>
        <div ref={bottom} />
      </div>
      <form onSubmit={(event) => void send(event)} className="space-y-2 border-t pt-3">
        {cooldown > 0 && <p role="status" className="text-sm text-amber-700">Hourly limit reached. You can send again in {cooldown}s.</p>}
        <label htmlFor="ai-message" className="sr-only">Your message</label>
        <textarea id="ai-message" value={text} onChange={(event) => setText(event.target.value)}
          disabled={sending || !conversation} maxLength={8000} rows={3} placeholder="Ask the assistant…"
          className="w-full resize-none rounded-md border px-3 py-2 text-sm disabled:opacity-50" />
        <div className="flex justify-end gap-3">
          {sending && <button type="button" onClick={() => controller.current?.abort()}
            className="rounded-md border px-4 py-2 text-sm">Stop generating</button>}
          <button type="submit" disabled={!conversation || sending || cooldown > 0 || !text.trim() || pending !== null}
            className="rounded-md bg-accent px-4 py-2 text-sm text-white disabled:opacity-50">Send</button>
        </div>
      </form>
    </div>
  )
}
