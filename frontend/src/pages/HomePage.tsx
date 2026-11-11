import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'

import NavIcon from '../components/NavIcon'
import Pager from '../components/Pager'
import QuestionCard, { AnswerStatus } from '../components/QuestionCard'
import { EmptyState, ErrorState, SkeletonCards } from '../components/StateBlocks'
import { useSimilarQuestions } from '../hooks/useSimilarQuestions'
import { api } from '../lib/api'
import type { QuestionPage } from '../lib/types'
import { TITLE_MAX } from '../lib/validation'

const SORTS = ['newest', 'votes', 'unanswered'] as const
type Sort = (typeof SORTS)[number]

const SORT_LABELS: Record<Sort, string> = {
  newest: 'Newest',
  votes: 'Top',
  unanswered: 'Unanswered',
}

const LIMIT = 20

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: QuestionPage }

// Unknown or missing values fall back to the defaults.
function parseSort(value: string | null): Sort {
  return (SORTS as readonly string[]).includes(value ?? '') ? (value as Sort) : 'newest'
}

function parsePage(value: string | null): number {
  const n = Number(value)
  return Number.isInteger(n) && n >= 1 ? n : 1
}

function errorMessage(err: unknown): string {
  return err instanceof Error && err.message ? err.message : 'Something went wrong.'
}

function AskBox() {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const similar = useSimilarQuestions(text)
  const hasText = text.trim().length > 0

  function continueToPost() {
    const title = text.trim().replace(/\s+/g, ' ').slice(0, TITLE_MAX)
    navigate('/ask', { state: title ? { title } : null })
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    continueToPost()
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault()
      continueToPost()
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`overflow-hidden rounded-2xl border bg-surface shadow-pop transition-colors ${
        hasText ? 'border-accent' : 'border-line2'
      }`}
    >
      <label htmlFor="ask-box" className="sr-only">
        Describe your problem
      </label>
      <textarea
        id="ask-box"
        rows={2}
        value={text}
        maxLength={TITLE_MAX}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="e.g. My React search input fires a request on every keystroke"
        className="block w-full resize-none bg-transparent px-4 pb-2 pt-4 text-base leading-normal text-ink placeholder:text-ink-dim focus:outline-none lg:px-5 lg:pt-[18px]"
      />
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5 px-4 pb-3.5 lg:px-5">
        <p className="text-[12.5px] text-ink-dim">Details, tags and files are added on the next step</p>
        <div className="flex w-full gap-2 sm:w-auto">
          {hasText && (
            <Link
              to={`/search?q=${encodeURIComponent(text.trim())}`}
              className="ah-btn-secondary flex-1 sm:flex-none"
            >
              <NavIcon name="search" size={16} />
              Search
            </Link>
          )}
          <button type="submit" className="ah-btn-primary flex-1 sm:flex-none">
            Continue to post
          </button>
        </div>
      </div>

      {similar.enabled && (
        <div className="border-t border-line bg-surface-raised px-4 py-3.5 lg:px-5" aria-live="polite">
          <p className="ah-overline mb-1.5">Similar questions</p>
          {similar.items === null ? (
            <div className="space-y-2.5 py-1.5" role="status" aria-label="Looking for similar questions">
              <div className="ah-skeleton h-3.5 w-4/5" />
              <div className="ah-skeleton h-3.5 w-3/5" />
            </div>
          ) : similar.items.length === 0 ? (
            <p className="py-1 text-body text-ink-muted">
              Nothing similar yet. Yours would be the first.
            </p>
          ) : (
            <ul>
              {similar.items.map((item) => (
                <li key={item.id}>
                  <Link
                    to={`/questions/${item.id}`}
                    className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2 no-underline transition-colors hover:bg-accent-wash"
                  >
                    <span className="min-w-0 break-words text-body font-medium text-ink">{item.title}</span>
                    <AnswerStatus count={item.answer_count} accepted={item.has_accepted_answer} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </form>
  )
}

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const sort = parseSort(searchParams.get('sort'))
  const page = parsePage(searchParams.get('page'))

  const [state, setState] = useState<State>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0) // bumped by Retry to refetch

  useEffect(() => {
    let ignore = false
    setState({ status: 'loading' })

    const query = new URLSearchParams({
      sort,
      page: String(page),
      limit: String(LIMIT),
    })

    api
      .get<QuestionPage>(`/questions?${query.toString()}`)
      .then((data) => {
        if (!ignore) setState({ status: 'ready', data })
      })
      .catch((err: unknown) => {
        if (!ignore) setState({ status: 'error', message: errorMessage(err) })
      })

    return () => {
      ignore = true
    }
  }, [sort, page, attempt])

  // A hand-typed ?page=99 beyond the last page jumps to the last page.
  useEffect(() => {
    if (state.status !== 'ready') return
    const { total, limit } = state.data
    const lastPage = Math.max(1, Math.ceil(total / limit))
    if (page > lastPage) {
      setSearchParams({ sort, page: String(lastPage) }, { replace: true })
    }
  }, [state, page, sort, setSearchParams])

  function selectSort(next: Sort) {
    if (next === sort && page === 1) return
    setSearchParams({ sort: next, page: '1' }) // pushes history, so Back works
  }

  function goToPage(next: number) {
    setSearchParams({ sort, page: String(next) })
  }

  const totalPages =
    state.status === 'ready' ? Math.max(1, Math.ceil(state.data.total / state.data.limit)) : 1

  function renderFeed() {
    if (state.status === 'loading') {
      return <SkeletonCards count={4} className="grid gap-3 sm:grid-cols-2" />
    }

    if (state.status === 'error') {
      return (
        <ErrorState
          title="Couldn't load questions"
          message={state.message}
          onRetry={() => setAttempt((n) => n + 1)}
        />
      )
    }

    if (state.data.total === 0) {
      return sort === 'unanswered' ? (
        <EmptyState title="Nothing waiting for an answer">
          Questions without answers will show up here.{' '}
          <button type="button" onClick={() => selectSort('newest')} className="ah-link">
            See newest
          </button>
        </EmptyState>
      ) : (
        <EmptyState title="No questions here yet">
          Be the first to{' '}
          <Link to="/ask" className="ah-link">
            ask a question
          </Link>
          .
        </EmptyState>
      )
    }

    return (
      <ul className="grid gap-3 sm:grid-cols-2">
        {state.data.items.map((item) => (
          <li key={item.id} className="min-w-0">
            <QuestionCard question={item} />
          </li>
        ))}
      </ul>
    )
  }

  return (
    <div className="flex flex-1 flex-col">
      <section className="mx-auto w-full max-w-[960px] px-4 pb-2 pt-6 lg:px-10 lg:pt-14">
        <h1 className="text-balance font-display text-[30px] font-bold leading-[1.1] tracking-[-0.035em] text-ink lg:text-[44px]">
          What are you stuck on?
        </h1>
        <p className="ah-lead mb-5 mt-2.5 lg:mb-6">
          Describe the problem. Knowly shows similar questions before you post.
        </p>
        <AskBox />
      </section>

      <section
        className="mx-auto w-full max-w-[960px] px-4 pb-8 pt-7 lg:px-10 lg:pb-12 lg:pt-9"
        aria-labelledby="recent-heading"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="recent-heading" className="ah-h2">
            Recent questions
          </h2>
          <div className="flex gap-2" role="group" aria-label="Sort questions">
            {SORTS.map((s) => (
              <button
                key={s}
                type="button"
                className={`ah-pill ${s === sort ? 'ah-pill-active' : ''}`}
                aria-pressed={s === sort}
                onClick={() => selectSort(s)}
              >
                {SORT_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
        {renderFeed()}
      </section>

      <Pager page={page} totalPages={totalPages} onChange={goToPage} label="Questions pagination" />
    </div>
  )
}
