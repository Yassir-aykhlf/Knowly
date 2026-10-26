import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import Avatar from '../components/Avatar'
import { api, ApiError } from '../lib/api'
import { relativeTime } from '../lib/format'
import type { Paginated, SearchResult } from '../lib/types'

type ResultsState =
  | { key: string; status: 'loading' }
  | { key: string; status: 'error'; message: string }
  | { key: string; status: 'ready'; data: Paginated<SearchResult> }

const FILTERS = ['q', 'tag', 'author', 'status', 'from', 'to', 'sort', 'page']
const inputClass = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600'
const buttonClass = 'rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50'

function renderHighlight(highlight: string): ReactNode[] {
  let marked = false
  return highlight.split(/(<mark>|<\/mark>)/g).map((part, index) => {
    if (part === '<mark>') { marked = true; return null }
    if (part === '</mark>') { marked = false; return null }
    return marked ? <mark key={index} className="rounded-sm bg-amber-100 text-inherit">{part}</mark> : part
  })
}

function ResultCard({ item, highlight }: { item: SearchResult; highlight: boolean }) {
  return (
    <article className="flex gap-4 border-b border-slate-200 py-5">
      <div className="w-16 shrink-0 space-y-2 text-right text-xs text-slate-500">
        <p><span className="font-semibold text-slate-800">{item.vote_total}</span> {item.vote_total === 1 ? 'vote' : 'votes'}</p>
        <p className={item.has_accepted_answer ? 'rounded border border-teal-600 p-1 text-teal-700' : ''}>
          {item.has_accepted_answer && <span aria-label="Has an accepted answer">✓ </span>}
          <span className="font-semibold">{item.answer_count}</span> {item.answer_count === 1 ? 'answer' : 'answers'}
        </p>
        <p>{item.view_count} {item.view_count === 1 ? 'view' : 'views'}</p>
      </div>
      <div className="min-w-0 flex-1 space-y-3">
        <h2 className="break-words text-lg font-semibold leading-snug">
          <Link to={`/questions/${item.id}`} className="text-slate-800 hover:text-accent hover:underline">{item.title}</Link>
        </h2>
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-slate-600">
          {highlight ? renderHighlight(item.highlight) : item.highlight}
        </p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <ul aria-label="Tags" className="flex flex-wrap gap-2">
            {item.tags.map((tag) => <li key={tag} className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">{tag}</li>)}
          </ul>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Avatar user={item.author} size={22} />
            <Link to={`/users/${item.author.id}`} className="font-medium hover:text-accent">{item.author.username}</Link>
            <time dateTime={item.created_at}>{relativeTime(item.created_at)}</time>
          </div>
        </div>
      </div>
    </article>
  )
}

export default function SearchPage() {
  const [params, setParams] = useSearchParams()
  const [tagDraft, setTagDraft] = useState('')
  const [attempt, setAttempt] = useState(0)
  const [state, setState] = useState<ResultsState>({ key: '', status: 'loading' })
  const q = params.get('q') ?? ''
  const tags = params.getAll('tag')
  const pageValue = Number(params.get('page') ?? 1)
  const page = Number.isSafeInteger(pageValue) && pageValue > 0 ? pageValue : 1
  const active = FILTERS.some((name) => params.has(name))
  const request = new URLSearchParams()
  for (const name of FILTERS) {
    if (name !== 'page') for (const value of params.getAll(name)) request.append(name, value)
  }
  request.set('page', String(page))
  request.set('limit', '20')
  const requestKey = request.toString()

  useEffect(() => {
    if (!active) return
    let ignore = false
    setState({ key: requestKey, status: 'loading' })
    const timer = window.setTimeout(() => {
      void api.get<Paginated<SearchResult>>(`/search?${requestKey}`).then((data) => {
        if (!ignore) setState({ key: requestKey, status: 'ready', data })
      }).catch((err: unknown) => {
        if (ignore) return
        const message = err instanceof ApiError
          ? [err.message, ...Object.values(err.fields ?? {})].join(' ')
          : 'Could not load search results. Please try again.'
        setState({ key: requestKey, status: 'error', message })
      })
    }, 200)
    return () => { ignore = true; window.clearTimeout(timer) }
  }, [active, requestKey, attempt])

  useEffect(() => {
    if (!active || state.status !== 'ready' || state.key !== requestKey) return
    const lastPage = Math.max(1, Math.ceil(state.data.total / state.data.limit))
    if (page > lastPage) {
      setParams((current) => {
        const next = new URLSearchParams(current)
        next.set('page', String(lastPage))
        return next
      }, { replace: true })
    }
  }, [active, state, requestKey, page, setParams])

  function change(name: string, value: string) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (value) next.set(name, value)
      else next.delete(name)
      next.delete('page')
      return next
    })
  }

  function changeTags(nextTags: string[]) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.delete('tag')
      next.delete('page')
      for (const tag of nextTags) next.append('tag', tag)
      return next
    })
  }

  function addTag() {
    const nextTags = [...new Set([...tags, ...tagDraft.split(',').map((tag) => tag.trim()).filter(Boolean)])]
    if (nextTags.length !== tags.length) changeTags(nextTags)
    setTagDraft('')
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.set('q', q)
      next.delete('page')
      return next
    })
    setAttempt((value) => value + 1)
  }

  function goToPage(nextPage: number) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.set('page', String(nextPage))
      return next
    })
  }

  function results() {
    if (!active) return (
      <div className="rounded-xl bg-slate-50 px-5 py-12 text-center">
        <h2 className="font-semibold">Find a question</h2>
        <p className="mt-2 text-sm text-slate-600">Enter words, choose filters, or select Search to browse all questions.</p>
      </div>
    )
    if (state.key !== requestKey || state.status === 'loading') return <p role="status" className="py-8 text-sm text-slate-500">Searching…</p>
    if (state.status === 'error') return (
      <div role="alert" className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
        <p>{state.message}</p>
        <button type="button" onClick={() => setAttempt((value) => value + 1)} className="mt-2 font-semibold underline">Retry</button>
      </div>
    )
    const { items, total, limit } = state.data
    const totalPages = Math.max(1, Math.ceil(total / limit))
    return (
      <div className="space-y-4">
        <p role="status" className="text-sm font-medium text-slate-600">{total} {total === 1 ? 'question' : 'questions'} found</p>
        {total === 0 ? (
          <div className="rounded-xl bg-slate-50 px-5 py-12 text-center">
            <h2 className="font-semibold">No questions match your search</h2>
            <p className="mt-2 text-sm text-slate-600">Try different words or remove a filter.</p>
          </div>
        ) : (
          <>
            <div>{items.map((item) => <ResultCard key={item.id} item={item} highlight={Boolean(q.trim())} />)}</div>
            <nav aria-label="Search pagination" className="flex flex-wrap items-center justify-center gap-4 pt-4">
              <button type="button" className={buttonClass} disabled={page <= 1} onClick={() => goToPage(page - 1)}>Previous</button>
              <span className="text-sm text-slate-600">Page {page} of {totalPages}</span>
              <button type="button" className={buttonClass} disabled={page >= totalPages} onClick={() => goToPage(page + 1)}>Next</button>
            </nav>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8 sm:px-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Search questions</h1>
        <p className="mt-2 text-sm text-slate-600">Find answers by topic, author, status or date. Copy the URL to share your search.</p>
      </header>
      <form onSubmit={submit} className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="flex-1 space-y-1 text-sm font-medium">
            <span>Search words</span>
            <input type="search" maxLength={200} value={q} onChange={(event) => change('q', event.target.value)} placeholder="Words or an exact phrase" className={inputClass} />
          </label>
          <button type="submit" className={buttonClass}>Search</button>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="space-y-2">
            <label htmlFor="search-tag" className="block text-sm font-medium">Tags</label>
            <div className="flex gap-2">
              <input id="search-tag" value={tagDraft} maxLength={200} placeholder="Add a tag" className={inputClass}
                onChange={(event) => setTagDraft(event.target.value)}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addTag() } }} />
              <button type="button" onClick={addTag} disabled={!tagDraft.trim()} aria-label="Add tag" className="rounded-lg border border-slate-300 bg-white px-3 text-sm disabled:opacity-50">Add</button>
            </div>
            <p className="text-xs text-slate-500">Questions must contain every selected tag.</p>
            {tags.length > 0 && <ul aria-label="Selected tags" className="flex flex-wrap gap-2">
              {tags.map((tag, index) => <li key={`${tag}:${index}`}>
                <button type="button" onClick={() => changeTags(tags.filter((_, i) => i !== index))} aria-label={`Remove tag ${tag}`}
                  className="rounded bg-teal-100 px-2 py-1 text-xs text-teal-900">{tag} ×</button>
              </li>)}
            </ul>}
          </div>
          <label className="space-y-1 text-sm font-medium">
            <span>Author</span>
            <input value={params.get('author') ?? ''} maxLength={30} onChange={(event) => change('author', event.target.value)} placeholder="Username" className={inputClass} />
          </label>
          <div className="space-y-1">
            <label htmlFor="search-status" className="text-sm font-medium">Status</label>
            <select id="search-status" value={params.get('status') ?? ''} onChange={(event) => change('status', event.target.value)} className={inputClass}>
              <option value="">Any status</option><option value="unanswered">Unanswered</option><option value="answered">Answered</option><option value="accepted">Accepted answer</option>
            </select>
          </div>
          <label className="space-y-1 text-sm font-medium">
            <span>From date</span>
            <input type="date" value={params.get('from') ?? ''} onChange={(event) => change('from', event.target.value)} className={inputClass} />
          </label>
          <label className="space-y-1 text-sm font-medium">
            <span>To date</span>
            <input type="date" value={params.get('to') ?? ''} onChange={(event) => change('to', event.target.value)} className={inputClass} />
          </label>
          <div className="space-y-1">
            <label htmlFor="search-sort" className="text-sm font-medium">Sort by</label>
            <select id="search-sort" value={params.get('sort') ?? ''} onChange={(event) => change('sort', event.target.value)} className={inputClass}>
              <option value="">Automatic</option><option value="relevance">Relevance</option><option value="newest">Newest</option><option value="votes">Votes</option><option value="answers">Answers</option>
            </select>
          </div>
        </div>
        {(active || tagDraft) && <button type="button" onClick={() => { setTagDraft(''); setParams({}) }} className="text-sm text-slate-600 underline hover:text-accent">Clear search</button>}
      </form>
      <section aria-label="Search results" aria-live="polite">{results()}</section>
    </div>
  )
}
