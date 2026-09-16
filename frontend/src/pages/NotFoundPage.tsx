import { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import Avatar from '../components/Avatar'
import { api, ApiError } from '../lib/api'
import { relativeTime } from '../lib/format'
import { describeNotification } from '../lib/notifications'
import type { AppNotification, Paginated } from '../lib/types'

const LIMIT = 20

export default function NotificationsPage() {
  const [page, setPage] = useState(1)
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
  const hasUnread = data ? data.items.some((n) => n.read_at === null) : false

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Notifications</h1>
        <button onClick={handleMarkAllRead} disabled={!hasUnread} className="text-sm text-accent hover:underline disabled:text-slate-300">
          Mark all read
        </button>
      </div>

      {loading && <div className="px-4 py-10 text-center text-sm text-slate-500">Loading…</div>}

      {!loading && error && (
        <div className="px-4 py-6 text-center text-sm text-red-700">
          <p className="mb-3">{error}</p>
          <button onClick={() => void load(page)} className="rounded-md border px-3 py-1">Retry</button>
        </div>
      )}

      {!loading && !error && data?.items.length === 0 && (
        <div className="px-4 py-10 text-center text-sm text-slate-500">No notifications yet.</div>
      )}

      {!loading && !error && data && data.items.length > 0 && (
        <>
          <ul className="divide-y rounded-lg border">
            {data.items.map((n) => {
              const unread = n.read_at === null
              return (
                <li key={n.id}>
                  <button onClick={() => handleRowClick(n)} className={`flex w-full gap-3 px-4 py-3 text-left ${unread ? 'bg-accent/5' : ''}`}>
                    <Avatar user={n.actor ?? { username: 'Someone', avatar_url: null }} size={36} />
                    <span className="flex-1">
                      <span className={unread ? 'font-semibold' : ''}>{describeNotification(n)}</span>
                      <span className="block text-xs text-slate-400">{relativeTime(n.created_at)}</span>
                    </span>
                    {unread && <span className="mt-1 h-2 w-2 rounded-full bg-accent" />}
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="mt-4 flex justify-between text-sm">
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>Previous</button>
            <span>Page {data.page} of {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>Next</button>
          </div>
        </>
      )}
    </div>
  )
}