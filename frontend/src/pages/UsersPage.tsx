import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import Avatar from '../components/Avatar'
import Pager from '../components/Pager'
import { EmptyState, ErrorState } from '../components/StateBlocks'
import UserSearchBar from '../components/UserSearchBar'
import { api } from '../lib/api'
import type { UserPage } from '../lib/types'

// Whole rows at common widths: 24 on desktop, 12 on phones.
function pageSize(): number {
  return window.matchMedia('(min-width: 1024px)').matches ? 24 : 12
}

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: UserPage }

function parsePage(value: string | null): number {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

function errorMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : 'Something went wrong.'
}

function memberSince(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return 'Member'
  return `Member since ${date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}`
}

export default function UsersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const page = parsePage(searchParams.get('page'))
  const q = searchParams.get('q') ?? ''
  const [limit] = useState(pageSize)

  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0) // bumped by Retry to refetch

  useEffect(() => {
    let ignore = false
    setState({ status: 'loading' })

    const query = new URLSearchParams({ page: String(page), limit: String(limit) })
    if (q) query.set('q', q)

    api
      .get<UserPage>(`/users?${query.toString()}`)
      .then((data) => {
        if (!ignore) setState({ status: 'ready', data })
      })
      .catch((err: unknown) => {
        if (!ignore) setState({ status: 'error', message: errorMessage(err) })
      })

    return () => {
      ignore = true
    }
  }, [page, q, limit, attempt])

  // A hand-typed ?page=99 beyond the last page jumps to the last page.
  useEffect(() => {
    if (state.status !== 'ready') return
    const lastPage = Math.max(1, Math.ceil(state.data.total / state.data.limit))
    if (page > lastPage) {
      const params: Record<string, string> = { page: String(lastPage) }
      if (q) params.q = q
      setSearchParams(params, { replace: true })
    }
  }, [state, page, q, setSearchParams])

  function goToPage(next: number) {
    const params: Record<string, string> = { page: String(next) }
    if (q) params.q = q
    setSearchParams(params)
  }

  function handleSearch(value: string) {
    setSearchParams(value ? { q: value } : {}, { replace: true })
  }

  const data = state.status === 'ready' ? state.data : null
  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.limit)) : 1
  const first = data && data.items.length > 0 ? (data.page - 1) * data.limit + 1 : 0

  function renderBody() {
    if (state.status === 'loading') {
      return (
        <div role="status" aria-label="Loading people" className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,230px),1fr))] gap-3">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="ah-card flex items-center gap-3 p-4">
              <div className="ah-skeleton h-12 w-12 shrink-0 rounded-full" />
              <div className="flex flex-1 flex-col gap-2">
                <div className="ah-skeleton h-4 w-2/3" />
                <div className="ah-skeleton h-3 w-full" />
              </div>
            </div>
          ))}
        </div>
      )
    }

    if (state.status === 'error') {
      return (
        <ErrorState title="Couldn't load people" message={state.message} onRetry={() => setAttempt((n) => n + 1)} />
      )
    }

    if (state.data.items.length === 0) {
      return (
        <EmptyState title={q ? 'No one matches that search' : 'No people yet'}>
          {q ? 'Try a different name.' : 'Members will show up here once they join.'}
        </EmptyState>
      )
    }

    return (
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,230px),1fr))] content-start gap-3">
        {state.data.items.map((item) => (
          <li key={item.id} className="min-w-0">
            <Link
              to={`/users/${item.id}`}
              className="ah-card ah-card-hover grid h-full grid-cols-[48px_minmax(0,1fr)] items-center gap-3 p-4 no-underline"
            >
              <Avatar user={item} size={48} />
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-semibold text-ink">{item.username}</span>
                <span className="block truncate text-meta text-ink-faint">{memberSince(item.created_at)}</span>
                {item.bio && <span className="mt-0.5 block truncate text-body-sm text-ink-muted">{item.bio}</span>}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="ah-page max-w-[1200px]">
        <header>
          <h1 className="ah-h1">People</h1>
          <div className="mt-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <p className="ah-lead">Meet the people sharing knowledge on Knowly.</p>
            {data && data.total > 0 && (
              <p className="text-body-sm text-ink-faint" role="status">
                Showing {first}–{first + data.items.length - 1} of {data.total.toLocaleString()}
              </p>
            )}
          </div>
          <div className="mt-5 max-w-[480px]">
            <UserSearchBar value={q} onSearch={handleSearch} />
          </div>
        </header>
        <div className="mt-6">{renderBody()}</div>
      </div>
      <Pager page={page} totalPages={totalPages} onChange={goToPage} label="People pagination" />
    </div>
  )
}
