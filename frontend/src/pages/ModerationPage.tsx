import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, Navigate } from 'react-router-dom'

import MarkdownBody from '../components/MarkdownBody'
import Modal from '../components/Modal'
import { EmptyState } from '../components/StateBlocks'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { api, ApiError } from '../lib/api'
import { relativeTime } from '../lib/format'
import type { PendingModerationItem } from '../lib/types'

const labels = { question: 'Question', answer: 'Answer', comment: 'Comment' }

export default function ModerationPage() {
  const { user, isLoading } = useAuth()
  if (isLoading) return <p className="ah-page text-body text-ink-muted" role="status">Checking access…</p>
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
    <div className="ah-page max-w-[940px] space-y-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 ref={heading} tabIndex={-1} className="ah-h1 focus:outline-none">Moderation queue</h1>
          <p className="ah-lead mt-2.5">
            Review pending content, oldest first
            {items !== null && <> · <span className="font-semibold text-warn">{items.length} pending</span></>}
          </p>
        </div>
        <button type="button" onClick={() => void loadQueue()} disabled={refreshing || busy !== null}
          className="ah-btn-secondary ah-btn-sm">Refresh queue</button>
      </header>

      {refreshing && <p role="status" className="text-body-sm text-ink-faint">{items === null ? 'Loading queue…' : 'Refreshing queue…'}</p>}
      {loadError && <p role="alert" className="ah-alert">
        {loadError}{' '}<button type="button" onClick={() => void loadQueue()} disabled={refreshing || busy !== null} className="font-semibold underline disabled:opacity-50">Retry loading</button>
      </p>}
      {items?.length === 0 && !refreshing && !loadError && (
        <EmptyState title="Nothing to review">New submissions that need a decision will show up here.</EmptyState>
      )}

      <div className="space-y-3">
        {items?.map((item) => (
          <article key={`${item.type}:${item.id}`} aria-label={`${labels[item.type]} by ${item.author.username}`}
            aria-busy={busy === `${item.type}:${item.id}`} className="ah-card space-y-3.5 p-4 lg:p-5">
            <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-body-sm">
              <span className="ah-status ah-status-warn">{labels[item.type]}</span>
              <Link to={`/users/${item.author.id}`} className="ah-link font-semibold">{item.author.username}</Link>
              <time dateTime={item.created_at} title={new Date(item.created_at).toLocaleString()} className="text-meta text-ink-faint">{relativeTime(item.created_at)}</time>
            </div>
            {item.title && <h2 className="break-words text-[17px] font-semibold leading-snug text-ink">{item.title}</h2>}
            <MarkdownBody markdown={item.body} compact />
            <div className="rounded-btn bg-warn-wash px-3.5 py-3 text-body-sm leading-relaxed text-warn-ink">
              <span className="font-semibold">Automated review: </span>{item.moderation_note || 'No automated explanation available.'}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3">
              {item.question_id ? <Link to={`/questions/${item.question_id}`} className="ah-link text-body-sm">View question context</Link>
                : <span className="text-body-sm text-ink-faint">Question context unavailable</span>}
              <div className="flex gap-2">
                <button type="button" onClick={() => void decide(item, 'approve')} disabled={busy !== null || refreshing}
                  className="ah-btn-primary ah-btn-sm">Approve</button>
                <button type="button" onClick={() => { setRejecting(item); setNote(''); setTouched(false); setServerError('') }} disabled={busy !== null || refreshing}
                  className="ah-btn ah-btn-sm border border-danger-line bg-surface text-danger hover:bg-danger-wash">Reject</button>
              </div>
            </div>
          </article>
        ))}
      </div>

      <Modal open={rejecting !== null} onClose={closeReject} title="Reject content">
        <form ref={form} tabIndex={-1} onSubmit={submitRejection} onKeyDown={trapFocus} aria-label="Rejection explanation" className="space-y-3 focus:outline-none">
          <p className="text-body text-ink-muted">Explain the decision to the author of this {rejecting?.type}. A reason is required.</p>
          <label htmlFor="rejection-note" className="ah-label mb-0">Reason for rejection</label>
          <textarea ref={noteInput} id="rejection-note" value={note} rows={4} disabled={busy !== null}
            onChange={(event) => { setNote(event.target.value); setTouched(true); setServerError('') }} onBlur={() => setTouched(true)}
            aria-invalid={Boolean(shownError)} aria-describedby="rejection-note-feedback"
            className="ah-textarea" />
          <div id="rejection-note-feedback" className="flex justify-between gap-3 text-meta">
            <span className={shownError ? 'text-danger' : 'text-ink-faint'}>{shownError || 'Use 1–1,000 characters.'}</span>
            <span className="shrink-0 tabular-nums text-ink-faint">{length} / 1,000</span>
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <button type="button" onClick={closeReject} disabled={busy !== null} className="ah-btn-ghost">Cancel</button>
            <button type="submit" disabled={busy !== null || Boolean(noteError)} className="ah-btn-danger">
              {busy !== null ? 'Saving…' : 'Reject content'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
