import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import Avatar from '../components/Avatar'
import Pager from '../components/Pager'
import { EmptyState, ErrorState, SkeletonRows } from '../components/StateBlocks'
import { api, ApiError } from '../lib/api'
import { relativeTime } from '../lib/format'
import { describeNotification } from '../lib/notifications'
import type { AppNotification, Paginated } from '../lib/types'

const LIMIT = 20

export default function NotificationsPage() {
  const [page, setPage] = useState(1)
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const [data, setData] = useState<Paginated<AppNotification> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  const load = useCallback(async (targetPage: number) => {
    setLoading(true)
    setError(null)
    try {
      const result = await api.get<Paginated<AppNotification>>(
        `/notifications?page=${targetPage}&limit=${LIMIT}`,
      )
      setData(result)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void load(page) }, [page, load])

  async function handleRowClick(n: AppNotification) {
    setData((prev) =>
      prev
        ? { ...prev, items: prev.items.map((it) =>
            it.id === n.id ? { ...it, read_at: it.read_at ?? new Date().toISOString() } : it) }
        : prev,
    )
    try { await api.put(`/notifications/${n.id}/read`) } catch {}
    navigate(n.link)
  }

  async function handleMarkAllRead() {
    if (!data) return
    setData({ ...data, items: data.items.map((it) => ({ ...it, read_at: it.read_at ?? new Date().toISOString() })) })
    try { await api.put('/notifications/read-all') } catch { void load(page) }
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1
  const unreadCount = data ? data.items.filter((n) => n.read_at === null).length : 0
  const hasUnread = unreadCount > 0
  const shown = data ? (filter === 'unread' ? data.items.filter((n) => n.read_at === null) : data.items) : []
  const today = new Date().toDateString()
  const groups = [
    { label: 'Today', items: shown.filter((n) => parseDate(n.created_at).toDateString() === today) },
    { label: 'Earlier', items: shown.filter((n) => parseDate(n.created_at).toDateString() !== today) },
  ].filter((group) => group.items.length > 0)

  return (
    <div className="flex flex-1 flex-col">
      <div className="ah-page max-w-[840px]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="ah-h1">Notifications</h1>
          <button type="button" onClick={() => void handleMarkAllRead()} disabled={!hasUnread} className="ah-btn-secondary ah-btn-sm">
            Mark all read
          </button>
        </div>

        <div className="mt-5 flex gap-2" role="group" aria-label="Filter notifications">
          <button type="button" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}
            className={`ah-pill ${filter === 'all' ? 'ah-pill-active' : ''}`}>All</button>
          <button type="button" aria-pressed={filter === 'unread'} onClick={() => setFilter('unread')}
            className={`ah-pill ${filter === 'unread' ? 'ah-pill-active' : ''}`}>
            Unread{unreadCount > 0 ? ` · ${unreadCount}` : ''}
          </button>
        </div>

        <div className="mt-5">
          {loading && !data && <div className="ah-card"><SkeletonRows count={5} /></div>}

          {!loading && error && (
            <ErrorState title="Couldn't load notifications" message={error} onRetry={() => void load(page)} />
          )}

          {!error && data && shown.length === 0 && (
            <EmptyState title="You're all caught up">
              {filter === 'unread' && data.items.length > 0
                ? 'Nothing unread on this page.'
                : 'New answers, comments and friend requests will show up here.'}
            </EmptyState>
          )}

          {!error && data && groups.map((group) => (
            <section key={group.label} className="mb-6 last:mb-0" aria-label={group.label}>
              <h2 className="ah-overline mb-2.5">{group.label}</h2>
              <ul className={`space-y-2.5 ${loading ? 'opacity-60' : ''}`}>
                {group.items.map((n) => {
                  const unread = n.read_at === null
                  const who = n.actor?.username
                  const text = describeNotification(n)
                  const rest = who && text.startsWith(who) ? text.slice(who.length) : null
                  return (
                    <li key={n.id}>
                      <button type="button" onClick={() => void handleRowClick(n)}
                        className={`grid w-full grid-cols-[38px_minmax(0,1fr)_10px] items-center gap-3 rounded-card border px-4 py-3.5 text-left transition-colors hover:border-accent-line ${
                          unread ? 'border-accent-soft bg-accent-wash' : 'border-line bg-surface'
                        }`}>
                        <Avatar user={n.actor ?? { username: 'Knowly', avatar_url: null }} size={38} />
                        <span className="min-w-0">
                          <span className="block break-words text-body-md text-ink-soft">
                            {rest !== null ? <><span className="font-semibold text-ink">{who}</span>{rest}</> : text}
                          </span>
                          <span className="mt-0.5 block text-meta text-ink-ghost">{relativeTime(n.created_at)}</span>
                        </span>
                        {unread && <span className="h-2.5 w-2.5 rounded-full bg-accent"><span className="sr-only">Unread</span></span>}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      </div>
      {!error && data && <Pager page={page} totalPages={totalPages} onChange={setPage} label="Notifications pagination" />}
    </div>
  )
}

function parseDate(iso: string): Date {
  return new Date(/(?:Z|[+-]\d{2}:?\d{2})$/i.test(iso) ? iso : `${iso}Z`)
}
