import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'

import NavIcon from '../components/NavIcon'
import Pager from '../components/Pager'
import QuestionCard from '../components/QuestionCard'
import { EmptyState, ErrorState, SkeletonCards } from '../components/StateBlocks'
import { api, ApiError } from '../lib/api'
import type { Paginated, SearchResult } from '../lib/types'

type ResultsState =
  | { key: string; status: 'loading' }
  | { key: string; status: 'error'; message: string }
  | { key: string; status: 'ready'; data: Paginated<SearchResult> }

const FILTERS = ['q', 'tag', 'author', 'status', 'from', 'to', 'sort', 'page']
const MORE_FILTERS = ['tag', 'author', 'from', 'to']

const STATUSES = [
  { value: '', label: 'Any status' },
  { value: 'unanswered', label: 'Unanswered' },
  { value: 'answered', label: 'Answered' },
  { value: 'accepted', label: 'Accepted answer' },
]

function renderHighlight(highlight: string): ReactNode[] {
  let marked = false
  return highlight.split(/(<mark>|<\/mark>)/g).map((part, index) => {
    if (part === '<mark>') { marked = true; return null }
    if (part === '</mark>') { marked = false; return null }
    return marked ? <mark key={index} className="rounded-sm bg-warn-tint px-0.5 text-inherit">{part}</mark> : part
  })
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
  const status = params.get('status') ?? ''
  const moreCount = MORE_FILTERS.filter((name) => params.has(name)).length
  const [moreOpen, setMoreOpen] = useState(moreCount > 0)
  const request = new URLSearchParams()
  for (const name of FILTERS) {
    if (name !== 'page') for (const value of params.getAll(name)) request.append(name, value)
  }
  request.set('page', String(page))
  request.set('limit', '20')
  const requestKey = request.toString()

  useEffect(() => {
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
  }, [requestKey, attempt])

  useEffect(() => {
    if (state.status !== 'ready' || state.key !== requestKey) return
    const lastPage = Math.max(1, Math.ceil(state.data.total / state.data.limit))
    if (page > lastPage) {
      setParams((current) => {
        const next = new URLSearchParams(current)
        next.set('page', String(lastPage))
        return next
      }, { replace: true })
    }
  }, [state, requestKey, page, setParams])

  function change(name: string, value: string) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (value) next.set(name, value)
      else next.delete(name)
      next.delete('page')
      return next
    }, { replace: true })
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

  const loading = state.key !== requestKey || state.status === 'loading'
  const ready = !loading && state.status === 'ready' ? state.data : null
  const totalPages = ready ? Math.max(1, Math.ceil(ready.total / ready.limit)) : 1

  function results() {
    if (loading) return <SkeletonCards count={3} className="grid gap-3" />
    if (state.status === 'error') return (
      <ErrorState title="Couldn't load results" message={state.message} onRetry={() => setAttempt((value) => value + 1)} />
    )
    if (!ready) return null
    if (ready.total === 0) return (
      <EmptyState
        title="No questions match your search"
        action={<Link to="/ask" state={q.trim() ? { title: q.trim() } : null} className="ah-btn-primary ah-btn-sm">Ask it as a new question</Link>}
      >
        Try different words or remove a filter.
      </EmptyState>
    )
    return (
      <ul className="grid gap-3">
        {ready.items.map((item) => (
          <li key={item.id} className="min-w-0">
            <QuestionCard question={item} excerpt={q.trim() ? renderHighlight(item.highlight) : item.highlight} />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="ah-page max-w-[1200px]">
        <header>
          <h1 className="ah-h1">Browse questions</h1>
          <p className="ah-lead mt-2.5">Search by words, tags, author, status or date. Copy the URL to share a search.</p>
        </header>

        <form onSubmit={submit} className="mt-5 lg:mt-6">
          <div className="flex items-center gap-1.5 rounded-card border border-line3 bg-surface p-1.5 transition-colors focus-within:border-accent">
            <NavIcon name="search" size={18} className="ml-2.5 text-ink-dim" />
            <label htmlFor="search-q" className="sr-only">Search words</label>
            <input id="search-q" type="search" maxLength={200} value={q} onChange={(event) => change('q', event.target.value)}
              placeholder="Words or an exact phrase"
              className="h-10 min-w-0 flex-1 bg-transparent px-1.5 text-base text-ink placeholder:text-ink-dim focus:outline-none lg:text-[15px]" />
            <button type="submit" className="ah-btn-primary">Search</button>
          </div>

          <div className="mt-5 grid gap-5 lg:mt-6 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-8">
            <div className="min-w-0 space-y-4 lg:space-y-5">
              {/* Mobile: status pills + a toggle for the remaining filters */}
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:hidden" role="group" aria-label="Status">
                {STATUSES.map((option) => (
                  <button key={option.value} type="button" aria-pressed={status === option.value}
                    onClick={() => change('status', option.value)}
                    className={`ah-pill ${status === option.value ? 'ah-pill-active' : ''}`}>
                    {option.label}
                  </button>
                ))}
                <button type="button" aria-expanded={moreOpen} aria-controls="more-filters"
                  onClick={() => setMoreOpen((value) => !value)}
                  className={`ah-pill ${moreOpen ? 'border-accent text-accent-dark' : ''}`}>
                  <NavIcon name="filter" size={14} />
                  More filters{moreCount > 0 ? ` · ${moreCount}` : ''}
                </button>
              </div>

              {/* Desktop: status as radio rows */}
              <fieldset className="hidden lg:block">
                <legend className="ah-overline mb-2">Status</legend>
                <div className="space-y-0.5">
                  {STATUSES.map((option) => {
                    const checked = status === option.value
                    return (
                      <label key={option.value}
                        className={`flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-body transition-colors ${
                          checked ? 'bg-accent-tint font-semibold text-accent-dark' : 'text-ink-soft hover:bg-line4'
                        }`}>
                        <input type="radio" name="status" value={option.value} checked={checked}
                          onChange={() => change('status', option.value)} className="peer sr-only" />
                        <span aria-hidden="true"
                          className={`h-4 w-4 shrink-0 rounded-full bg-surface peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent ${
                            checked ? 'border-4 border-accent' : 'border border-line3'
                          }`} />
                        {option.label}
                      </label>
                    )
                  })}
                </div>
              </fieldset>

              <div id="more-filters" className={`${moreOpen ? 'grid' : 'hidden'} gap-4 rounded-card border border-line bg-surface p-4 sm:grid-cols-2 lg:grid lg:grid-cols-1 lg:gap-5 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0`}>
                <div>
                  <label htmlFor="search-tag" className="ah-overline mb-2 block">Tags</label>
                  <div className="flex gap-2">
                    <input id="search-tag" value={tagDraft} maxLength={200} placeholder="Add a tag" className="ah-input"
                      onChange={(event) => setTagDraft(event.target.value)}
                      onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ',') { event.preventDefault(); addTag() } }} />
                    <button type="button" onClick={addTag} disabled={!tagDraft.trim()} aria-label="Add tag" className="ah-btn-secondary px-3">Add</button>
                  </div>
                  {tags.length > 0 && <ul aria-label="Selected tags" className="mt-2 flex flex-wrap gap-1.5">
                    {tags.map((tag, index) => <li key={`${tag}:${index}`}>
                      <button type="button" onClick={() => changeTags(tags.filter((_, i) => i !== index))} aria-label={`Remove tag ${tag}`}
                        className="ah-tag gap-1.5 py-1.5 hover:bg-line3">{tag} <span aria-hidden="true">×</span></button>
                    </li>)}
                  </ul>}
                  <p className="ah-help">Questions must have every selected tag.</p>
                </div>
                <div>
                  <label htmlFor="search-author" className="ah-overline mb-2 block">Author</label>
                  <input id="search-author" value={params.get('author') ?? ''} maxLength={30} onChange={(event) => change('author', event.target.value)} placeholder="Username" className="ah-input" />
                </div>
                <div className="grid grid-cols-2 gap-3 sm:col-span-2 lg:col-span-1 lg:grid-cols-1 lg:gap-5">
                  <div className="min-w-0">
                    <label htmlFor="search-from" className="ah-overline mb-2 block">From</label>
                    <input id="search-from" type="date" value={params.get('from') ?? ''} onChange={(event) => change('from', event.target.value)} className="ah-input min-w-0" />
                  </div>
                  <div className="min-w-0">
                    <label htmlFor="search-to" className="ah-overline mb-2 block">To</label>
                    <input id="search-to" type="date" value={params.get('to') ?? ''} onChange={(event) => change('to', event.target.value)} className="ah-input min-w-0" />
                  </div>
                </div>
              </div>
            </div>

            <section aria-label="Search results" className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <p role="status" className="text-body font-medium text-ink-soft">
                  {ready
                    ? <>{ready.total.toLocaleString()} {ready.total === 1 ? 'result' : 'results'}{q.trim() && <> for <span className="font-semibold text-ink">“{q.trim()}”</span></>}</>
                    : loading ? 'Searching…' : ''}
                </p>
                <div className="flex items-center gap-3">
                  <label htmlFor="search-sort" className="text-body-sm text-ink-faint">Sort</label>
                  <select id="search-sort" value={params.get('sort') ?? ''} onChange={(event) => change('sort', event.target.value)}
                    className="h-9 rounded-[9px] border border-line3 bg-surface px-2 text-body-sm font-medium text-ink focus:border-accent focus:outline-none">
                    <option value="">Automatic</option><option value="relevance">Relevance</option><option value="newest">Newest</option><option value="votes">Votes</option><option value="answers">Answers</option>
                  </select>
                  {(active || tagDraft) && <button type="button" onClick={() => { setTagDraft(''); setParams({}) }} className="ah-link text-body-sm">Clear search</button>}
                </div>
              </div>
              {results()}
            </section>
          </div>
        </form>
      </div>
      <Pager page={page} totalPages={totalPages} onChange={goToPage} label="Search pagination" />
    </div>
  )
}
