import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'

import Avatar from '../components/Avatar'
import Modal from '../components/Modal'
import NavIcon from '../components/NavIcon'
import Pager from '../components/Pager'
import { EmptyState, ErrorState, SkeletonRows } from '../components/StateBlocks'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'
import { api, ApiError } from '../lib/api'
import type { User, UserPage } from '../lib/types'
import { USERNAME_RE } from '../lib/validation'

const LIMIT = 20
const SEARCH_MAX = 254
const BIO_MAX = 500
const SEARCH_DELAY_MS = 300

type RoleFilter = '' | 'user' | 'admin'

const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'user', label: 'Users' },
  { value: 'admin', label: 'Admins' },
]

type Action = { kind: 'edit' | 'role' | 'delete'; target: User }

function parsePage(value: string | null): number {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

function parseRole(value: string | null): RoleFilter {
  return value === 'user' || value === 'admin' ? value : ''
}

function charCount(value: string): number {
  return Array.from(value.trim()).length
}

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError && err.message ? err.message : fallback
}

function joined(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime())
    ? '—'
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminUsersPage() {
  const { user, isLoading } = useAuth()
  if (isLoading) return <p className="ah-page text-body text-ink-muted" role="status">Checking access…</p>
  if (!user) return <Navigate to="/login" replace />
  if (user.role !== 'admin') return <Navigate to="/403" replace />
  return <UserAdmin key={user.id} me={user} />
}

function UserAdmin({ me }: { me: User }) {
  const { refresh } = useAuth()
  const { showToast } = useToast()
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePage(searchParams.get('page'))
  const q = (searchParams.get('q') ?? '').slice(0, SEARCH_MAX)
  const role = parseRole(searchParams.get('role'))

  const [draft, setDraft] = useState(q)
  const [data, setData] = useState<UserPage | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [reloadKey, setReloadKey] = useState(0)
  const [action, setAction] = useState<Action | null>(null)

  function updateParams(next: { q?: string; role?: RoleFilter; page?: number }, replace = false) {
    const merged = { q, role, page, ...next }
    const params: Record<string, string> = {}
    if (merged.q) params.q = merged.q
    if (merged.role) params.role = merged.role
    if (merged.page > 1) params.page = String(merged.page)
    setSearchParams(params, { replace })
  }

  useEffect(() => {
    setDraft((current) => (current.trim() === q ? current : q))
  }, [q])

  useEffect(() => {
    const value = draft.trim()
    if (value === q) return
    const timer = window.setTimeout(() => updateParams({ q: value, page: 1 }, true), SEARCH_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [draft, q])

  useEffect(() => {
    let ignore = false
    setLoading(true)
    setLoadError('')
    const query = new URLSearchParams({ page: String(page), limit: String(LIMIT) })
    if (q) query.set('q', q)
    if (role) query.set('role', role)
    api.get<UserPage>(`/admin/users?${query.toString()}`)
      .then((result) => { if (!ignore) setData(result) })
      .catch((err: unknown) => {
        if (ignore) return
        if (err instanceof ApiError && (err.status === 401 || err.status === 403)) void refresh()
        setLoadError(errorText(err, 'Could not load users.'))
      })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [page, q, role, reloadKey, refresh])

  useEffect(() => {
    if (!data || loading) return
    const lastPage = Math.max(1, Math.ceil(data.total / data.limit))
    if (page > lastPage) updateParams({ page: lastPage }, true)
  }, [data, loading, page])

  function finish(message: string, changedMe = false) {
    setAction(null)
    showToast(message)
    if (changedMe) void refresh()
    setReloadKey((n) => n + 1)
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1
  const first = data && data.items.length > 0 ? (data.page - 1) * data.limit + 1 : 0
  const last = data ? first + data.items.length - 1 : 0

  function renderBody() {
    if (loadError && !data) {
      return <ErrorState title="Couldn't load users" message={loadError} onRetry={() => setReloadKey((n) => n + 1)} />
    }
    if (!data) return <div className="ah-card"><SkeletonRows count={6} /></div>
    if (data.items.length === 0) {
      return (
        <EmptyState title={q || role ? 'No account matches these filters' : 'No accounts yet'}>
          {q || role ? 'Try another name or email, or clear the role filter.' : 'Accounts appear here once people sign up.'}
        </EmptyState>
      )
    }
    return (
      <div className="ah-card overflow-hidden" aria-busy={loading}>
        <div aria-hidden="true" className="hidden grid-cols-[minmax(0,1fr)_88px_120px_268px] gap-4 border-b border-line3 bg-fill-subtle px-4 py-2.5 text-meta font-semibold uppercase tracking-[0.04em] text-ink-faint lg:grid">
          <span>Account</span><span>Role</span><span>Joined</span><span className="text-right">Actions</span>
        </div>
        <ul className={`divide-y divide-line3 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          {data.items.map((item) => (
            <UserRow key={item.id} item={item} isMe={item.id === me.id} disabled={loading}
              onAction={(kind) => setAction({ kind, target: item })} />
          ))}
        </ul>
      </div>
    )
  }

  return (
    <div className="ah-page flex max-w-[1080px] flex-1 flex-col gap-5">
      <header>
        <h1 className="ah-h1">Manage users</h1>
        <p className="ah-lead mt-2.5">
          Edit profiles, change roles and delete accounts
          {data && <> · <span className="font-semibold text-ink">{data.total.toLocaleString()} {data.total === 1 ? 'account' : 'accounts'}</span></>}
        </p>
      </header>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-[380px]">
          <label htmlFor="admin-users-search" className="sr-only">Search by username or email</label>
          <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint">
            <NavIcon name="search" size={18} />
          </span>
          <input id="admin-users-search" type="search" value={draft} maxLength={SEARCH_MAX}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Search by username or email" autoComplete="off" className="ah-input pl-10" />
        </div>
        <div role="group" aria-label="Filter by role" className="ah-seg self-start">
          {ROLE_FILTERS.map((option) => (
            <button key={option.label} type="button" aria-pressed={role === option.value}
              onClick={() => updateParams({ role: option.value, page: 1 })}
              className={`ah-seg-item ${role === option.value ? 'ah-seg-item-active' : ''}`}>
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <p role="status" className="min-h-[20px] text-body-sm text-ink-faint">
        {loading && data ? 'Updating…' : data && data.items.length > 0 ? `Showing ${first}–${last} of ${data.total.toLocaleString()}` : ''}
      </p>
      {loadError && data && (
        <p role="alert" className="ah-alert">
          {loadError}{' '}
          <button type="button" onClick={() => setReloadKey((n) => n + 1)} className="font-semibold underline">Retry</button>
        </p>
      )}

      {renderBody()}

      <Pager page={page} totalPages={totalPages} onChange={(next) => updateParams({ page: next })} label="User pages" />

      {action?.kind === 'edit' && (
        <EditUserDialog target={action.target} onClose={() => setAction(null)}
          onSaved={(updated) => finish(`Saved changes to ${updated.username}.`, updated.id === me.id)} />
      )}
      {action?.kind === 'role' && (
        <RoleDialog target={action.target} onClose={() => setAction(null)}
          onSaved={(updated) => finish(updated.role === 'admin'
            ? `${updated.username} is now an admin.`
            : `${updated.username} is no longer an admin.`)} />
      )}
      {action?.kind === 'delete' && (
        <DeleteDialog target={action.target} onClose={() => setAction(null)}
          onDeleted={() => finish(`Deleted the account of ${action.target.username}.`)} />
      )}
    </div>
  )
}

type RowProps = {
  item: User
  isMe: boolean
  disabled: boolean
  onAction: (kind: Action['kind']) => void
}

function UserRow({ item, isMe, disabled, onAction }: RowProps) {
  const selfNote = 'Use Settings to manage your own account'
  return (
    <li className="grid gap-3 px-4 py-3.5 lg:grid-cols-[minmax(0,1fr)_88px_120px_268px] lg:items-center lg:gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar user={item} size={40} />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-2">
            <Link to={`/users/${item.id}`} className="ah-link truncate font-semibold">{item.username}</Link>
            {isMe && <span className="ah-status">You</span>}
          </div>
          <p className="truncate text-body-sm text-ink-muted">{item.email ?? 'No email on file'}</p>
        </div>
      </div>
      <div className="flex items-center gap-3 lg:contents">
        <span>
          <span className={`ah-status ${item.role === 'admin' ? 'ah-status-accepted' : ''}`}>
            {item.role === 'admin' ? 'Admin' : 'User'}
          </span>
        </span>
        <span className="text-body-sm text-ink-muted">
          <span className="lg:hidden">Joined </span>
          <time dateTime={item.created_at}>{joined(item.created_at)}</time>
        </span>
      </div>
      <div className="flex flex-wrap gap-2 lg:justify-end">
        <button type="button" disabled={disabled} onClick={() => onAction('edit')}
          aria-label={`Edit ${item.username}`} className="ah-btn-secondary ah-btn-sm">Edit</button>
        <button type="button" disabled={disabled || isMe} onClick={() => onAction('role')}
          title={isMe ? 'You cannot change your own role' : undefined}
          aria-label={`${item.role === 'admin' ? 'Demote' : 'Promote'} ${item.username}`}
          className="ah-btn-secondary ah-btn-sm">
          {item.role === 'admin' ? 'Demote' : 'Promote'}
        </button>
        <button type="button" disabled={disabled || isMe} onClick={() => onAction('delete')}
          title={isMe ? selfNote : undefined}
          aria-label={`Delete ${item.username}`} className="ah-btn-danger-outline ah-btn-sm">Delete</button>
      </div>
    </li>
  )
}

type DialogProps = { target: User; onClose: () => void }

function EditUserDialog({ target, onClose, onSaved }: DialogProps & { onSaved: (user: User) => void }) {
  const [username, setUsername] = useState(target.username)
  const [bio, setBio] = useState(target.bio ?? '')
  const [errors, setErrors] = useState<{ username?: string; bio?: string; form?: string }>({})
  const [busy, setBusy] = useState(false)
  const usernameInput = useRef<HTMLInputElement>(null)

  const bioLength = charCount(bio)
  const usernameError = USERNAME_RE.test(username) ? '' : 'Use 3–30 letters, numbers, _ or -.'
  const bioError = bioLength > BIO_MAX ? `Use no more than ${BIO_MAX} characters.` : ''
  const usernameChanged = username !== target.username
  const bioChanged = bio.trim() !== (target.bio ?? '')

  useEffect(() => { usernameInput.current?.focus() }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || usernameError || bioError || (!usernameChanged && !bioChanged)) return
    setBusy(true)
    setErrors({})
    const body: { username?: string; bio?: string } = {}
    if (usernameChanged) body.username = username
    if (bioChanged) body.bio = bio
    try {
      onSaved(await api.patch<User>(`/admin/users/${target.id}`, body))
    } catch (err) {
      const fields = err instanceof ApiError ? err.fields : undefined
      setErrors(fields && (fields.username || fields.bio)
        ? { username: fields.username, bio: fields.bio }
        : { form: errorText(err, 'Could not save the changes.') })
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={busy ? () => {} : onClose} title={`Edit ${target.username}`}>
      <form onSubmit={submit} noValidate className="space-y-4">
        <div>
          <label htmlFor="admin-edit-username" className="ah-label">Username</label>
          <input ref={usernameInput} id="admin-edit-username" value={username} maxLength={30} disabled={busy}
            onChange={(event) => { setUsername(event.target.value); setErrors((old) => ({ ...old, username: '' })) }}
            aria-invalid={Boolean(errors.username) || (username.length > 0 && Boolean(usernameError))}
            aria-describedby="admin-edit-username-help" autoComplete="off" className="ah-input" />
          <p id="admin-edit-username-help" className={`ah-help ${usernameError && username.length > 0 ? 'text-warn' : ''}`}>
            3–30 letters, numbers, _ or -.
          </p>
          {errors.username && <p className="ah-error" role="alert">{errors.username}</p>}
        </div>
        <div>
          <label htmlFor="admin-edit-bio" className="ah-label">Bio</label>
          <textarea id="admin-edit-bio" value={bio} rows={4} disabled={busy}
            onChange={(event) => { setBio(event.target.value); setErrors((old) => ({ ...old, bio: '' })) }}
            aria-invalid={Boolean(errors.bio) || Boolean(bioError)} aria-describedby="admin-edit-bio-help"
            className="ah-textarea" />
          <p id="admin-edit-bio-help" className={`ah-help tabular-nums ${bioError ? 'text-danger' : ''}`}>
            {bioError || `${bioLength}/${BIO_MAX} characters. Leave empty to remove the bio.`}
          </p>
          {errors.bio && <p className="ah-error" role="alert">{errors.bio}</p>}
        </div>
        {errors.form && <p role="alert" className="ah-alert">{errors.form}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="ah-btn-ghost">Cancel</button>
          <button type="submit" disabled={busy || Boolean(usernameError) || Boolean(bioError) || (!usernameChanged && !bioChanged)}
            className="ah-btn-primary">{busy ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </Modal>
  )
}

function RoleDialog({ target, onClose, onSaved }: DialogProps & { onSaved: (user: User) => void }) {
  const promote = target.role !== 'admin'
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function confirm() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      onSaved(await api.patch<User>(`/admin/users/${target.id}/role`, { role: promote ? 'admin' : 'user' }))
    } catch (err) {
      setError(errorText(err, 'Could not change the role.'))
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={busy ? () => {} : onClose} title={promote ? 'Make admin' : 'Remove admin access'}>
      <div className="space-y-4">
        <p className="text-body text-ink-muted">
          {promote
            ? <>Give <strong className="text-ink">{target.username}</strong> admin access? They will see content held by moderation, review the moderation queue and manage users.</>
            : <>Remove admin access from <strong className="text-ink">{target.username}</strong>? They will lose access to the moderation queue and to user management.</>}
        </p>
        <p className="rounded-btn bg-warn-wash px-3.5 py-3 text-body-sm text-warn-ink">
          They will be signed out of every session so the new role applies at once.
        </p>
        {error && <p role="alert" className="ah-alert">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="ah-btn-ghost">Cancel</button>
          <button type="button" onClick={() => void confirm()} disabled={busy}
            className={promote ? 'ah-btn-primary' : 'ah-btn-danger'}>
            {busy ? 'Saving…' : promote ? 'Make admin' : 'Remove admin'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

function DeleteDialog({ target, onClose, onDeleted }: DialogProps & { onDeleted: () => void }) {
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const confirmInput = useRef<HTMLInputElement>(null)
  const matches = typed === target.username

  useEffect(() => { confirmInput.current?.focus() }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (busy || !matches) return
    setBusy(true)
    setError('')
    try {
      await api.del(`/admin/users/${target.id}`)
      onDeleted()
    } catch (err) {
      setError(errorText(err, 'Could not delete the account.'))
      setBusy(false)
    }
  }

  return (
    <Modal open onClose={busy ? () => {} : onClose} title="Delete account">
      <form onSubmit={submit} className="space-y-4">
        <p className="text-body text-ink-muted">
          This signs <strong className="text-ink">{target.username}</strong> out everywhere and removes their
          private messages, friendships, notifications and AI conversations. Their questions, answers and
          comments stay on the forum under an anonymized name. This cannot be undone.
        </p>
        <div>
          <label htmlFor="admin-delete-confirm" className="ah-label">
            Type <span className="font-mono">{target.username}</span> to confirm
          </label>
          <input ref={confirmInput} id="admin-delete-confirm" value={typed} disabled={busy}
            onChange={(event) => setTyped(event.target.value)} autoComplete="off" spellCheck={false}
            className="ah-input" />
        </div>
        {error && <p role="alert" className="ah-alert">{error}</p>}
        <div className="flex flex-wrap justify-end gap-2">
          <button type="button" onClick={onClose} disabled={busy} className="ah-btn-ghost">Cancel</button>
          <button type="submit" disabled={busy || !matches} className="ah-btn-danger">
            {busy ? 'Deleting…' : 'Delete account'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
