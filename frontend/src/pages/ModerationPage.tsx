import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'

import MarkdownBody from '../components/MarkdownBody'
import Modal from '../components/Modal'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { api, ApiError } from '../lib/api'
import { relativeTime } from '../lib/format'
import type { PendingModerationItem } from '../lib/types'

const labels = { question: 'Question', answer: 'Answer', comment: 'Comment' }

export default function ModerationPage() {
  const { user, isLoading } = useAuth()
  if (isLoading) return <p className="px-4 py-8 text-sm text-slate-500">Checking access…</p>
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/403" replace />
  return <ModerationQueue key={user.id} />
}

function ModerationQueue() {
  const { showToast } = useToast()
  const [items, setItems] = useState<PendingModerationItem[] | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const [rejecting, setRejecting] = useState<PendingModerationItem | null>(null)
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const [serverError, setServerError] = useState('')
  const mounted = useRef(false)
  const sequence = useRef(0)
  const acting = useRef(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const form = useRef<HTMLFormElement>(null)
  const noteInput = useRef<HTMLTextAreaElement>(null)
  const length = Array.from(note.trim()).length
  const noteError = length === 0 ? 'Enter a reason for rejection.'
    : length > 1000 ? 'Use no more than 1,000 characters.' : ''
  const shownError = serverError || (touched ? noteError : '')

  const loadQueue = useCallback(async (decisionSaved = false) => {
    const request = ++sequence.current
    setRefreshing(true)
    setLoadError('')
    try {
      const data = await api.get<PendingModerationItem[]>('/moderation/pending')
      if (mounted.current && request === sequence.current) setItems(data)
    } catch (err) {
      if (mounted.current && request === sequence.current) {
        const message = err instanceof ApiError ? err.message : 'Could not load the moderation queue.'
        const detail = decisionSaved ? `Decision saved, but the queue could not be refreshed. ${message}` : message
        setLoadError(detail)
        showToast(detail, 'error')
      }
    } finally {
      if (mounted.current && request === sequence.current) setRefreshing(false)
    }
  }, [showToast])

  useEffect(() => {
    mounted.current = true
    void loadQueue()
    return () => { mounted.current = false; sequence.current++ }
  }, [loadQueue])

  useEffect(() => {
    if (!rejecting) return
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null
    form.current?.closest('[role="dialog"]')?.setAttribute('aria-label', 'Reject content')
    noteInput.current?.focus()
    return () => {
      if (previous?.isConnected) previous.focus()
      else heading.current?.focus()
    }
  }, [rejecting])

  useEffect(() => {
    if (rejecting && busy !== null) form.current?.focus()
  }, [rejecting, busy])

  function closeReject() {
    if (acting.current) return
    setRejecting(null)
    setNote('')
    setTouched(false)
    setServerError('')
  }

  async function decide(item: PendingModerationItem, verdict: 'approve' | 'reject') {
    if (acting.current || (verdict === 'reject' && noteError)) return
    acting.current = true
    setBusy(`${item.type}:${item.id}`)
    setServerError('')
    try {
      await api.put(`/moderation/${item.type}/${item.id}/${verdict}`,
        verdict === 'reject' ? { note: note.trim() } : undefined)
      if (!mounted.current) return
      setItems((previous) => previous?.filter((row) => row.type !== item.type || row.id !== item.id) ?? null)
      setRejecting(null)
      setNote('')
      setTouched(false)
      showToast(verdict === 'approve' ? 'Content approved.' : 'Content rejected.')
      await loadQueue(true)
    } catch (err) {
      if (!mounted.current) return
      const message = err instanceof ApiError ? err.message : 'Could not confirm the decision. Refresh the queue before retrying.'
      if (verdict === 'reject') setServerError(err instanceof ApiError ? err.fields?.note || message : message)
      showToast(message, 'error')
    } finally {
      acting.current = false
      if (mounted.current) setBusy(null)
    }
  }

  function submitRejection(event: FormEvent) {
    event.preventDefault()
    setTouched(true)
    if (rejecting && !noteError) void decide(rejecting, 'reject')
  }

  function trapFocus(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Tab') return
    const controls = form.current?.querySelectorAll<HTMLElement>('textarea:not([disabled]), button:not([disabled])')
    if (!controls?.length) { event.preventDefault(); return }
    const first = controls[0]
    const last = controls[controls.length - 1]
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 ref={heading} tabIndex={-1} className="text-2xl font-semibold">Moderation queue</h1>
          <p className="mt-1 text-sm text-slate-500">Review pending content, oldest first.</p>
        </div>
        <button type="button" onClick={() => void loadQueue()} disabled={refreshing || busy !== null}
          className="rounded-md border px-3 py-2 text-sm disabled:opacity-50">Refresh queue</button>
      </header>
      {refreshing && <p role="status" className="text-sm text-slate-500">{items === null ? 'Loading queue…' : 'Refreshing queue…'}</p>}
      {loadError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
        {loadError}{' '}<button type="button" onClick={() => void loadQueue()} disabled={refreshing || busy !== null} className="underline disabled:opacity-50">Retry loading</button>
      </p>}
      {items?.length === 0 && !refreshing && !loadError && <p className="rounded-lg border p-6 text-slate-500">Nothing to review.</p>}
      <div className="space-y-4">
        {items?.map((item) => (
          <article key={`${item.type}:${item.id}`} aria-label={`${labels[item.type]} by ${item.author.username}`}
            aria-busy={busy === `${item.type}:${item.id}`} className="space-y-3 rounded-lg border bg-white p-5">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="rounded-full bg-amber-100 px-2 py-0.5 font-medium text-amber-900">{labels[item.type]}</span>
              <Link to={`/users/${item.author.id}`} className="text-accent hover:underline">{item.author.username}</Link>
              <time dateTime={item.created_at} title={new Date(item.created_at).toLocaleString()} className="text-xs text-slate-500">{relativeTime(item.created_at)}</time>
            </div>
            {item.title && <h2 className="break-words text-lg font-semibold">{item.title}</h2>}
            <MarkdownBody markdown={item.body} />
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              <span className="font-medium">Automated review: </span>{item.moderation_note || 'No automated explanation available.'}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {item.question_id ? <Link to={`/questions/${item.question_id}`} className="text-sm text-accent hover:underline">View question context</Link>
                : <span className="text-sm text-slate-500">Question context unavailable</span>}
              <div className="flex gap-2">
                <button type="button" onClick={() => void decide(item, 'approve')} disabled={busy !== null || refreshing}
                  className="rounded-md bg-accent px-3 py-2 text-sm text-white disabled:opacity-50">Approve</button>
                <button type="button" onClick={() => { setRejecting(item); setNote(''); setTouched(false); setServerError('') }} disabled={busy !== null || refreshing}
                  className="rounded-md border border-red-200 px-3 py-2 text-sm text-red-700 disabled:opacity-50">Reject</button>
              </div>
            </div>
          </article>
        ))}
      </div>
      <Modal open={rejecting !== null} onClose={closeReject} title="Reject content">
        <form ref={form} tabIndex={-1} onSubmit={submitRejection} onKeyDown={trapFocus} aria-label="Rejection explanation" className="space-y-3">
          <p className="text-sm text-slate-600">Explain the decision to the author of this {rejecting?.type}. A reason is required.</p>
          <label htmlFor="rejection-note" className="block text-sm font-medium">Reason for rejection</label>
          <textarea ref={noteInput} id="rejection-note" value={note} rows={4} disabled={busy !== null}
            onChange={(event) => { setNote(event.target.value); setTouched(true); setServerError('') }} onBlur={() => setTouched(true)}
            aria-invalid={Boolean(shownError)} aria-describedby="rejection-note-feedback"
            className="w-full rounded-md border px-3 py-2 text-sm disabled:opacity-50" />
          <div id="rejection-note-feedback" className="flex justify-between gap-3 text-xs">
            <span className="text-red-700">{shownError || 'Use 1–1,000 characters.'}</span>
            <span className="shrink-0 text-slate-500">{length} / 1,000</span>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={closeReject} disabled={busy !== null} className="rounded-md border px-3 py-2 text-sm disabled:opacity-50">Cancel</button>
            <button type="submit" disabled={busy !== null || Boolean(noteError)} className="rounded-md bg-red-700 px-3 py-2 text-sm text-white disabled:opacity-50">
              {busy !== null ? 'Saving…' : 'Reject content'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
