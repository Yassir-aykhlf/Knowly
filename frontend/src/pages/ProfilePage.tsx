import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import AddFriendButton from '../components/AddFriendButton'
import Avatar from '../components/Avatar'
import Pager from '../components/Pager'
import QuestionCard from '../components/QuestionCard'
import { EmptyState, ErrorState, SkeletonCards } from '../components/StateBlocks'
import { useAuth } from '../contexts/AuthContext'
import { api, ApiError } from '../lib/api'
import type {
  AnswerListItem,
  Paginated,
  QuestionListItem,
  UserProfile,
} from '../lib/types'

type Tab = 'questions' | 'answers'
const PAGE_SIZE = 10

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [tab, setTab] = useState<Tab>('questions')
  const [page, setPage] = useState(1)
  const [questions, setQuestions] = useState<Paginated<QuestionListItem> | null>(null)
  const [answers, setAnswers] = useState<Paginated<AnswerListItem> | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [listLoading, setListLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    let active = true

    setProfile(null)
    setQuestions(null)
    setAnswers(null)
    setTab('questions')
    setPage(1)
    setProfileLoading(true)
    setError(null)

    api.get<UserProfile>(`/users/${id}`)
      .then((data) => {
        if (active) setProfile(data)
      })
      .catch((err) => {
        if (active) {
          setError(
            err instanceof ApiError && err.status === 404
              ? 'User not found.'
              : 'Could not load this profile.',
          )
        }
      })
      .finally(() => {
        if (active) setProfileLoading(false)
      })

    return () => {
      active = false
    }
  }, [id])

  useEffect(() => {
    if (!id || !profile || profile.id !== id) return

    let active = true
    setListLoading(true)
    setError(null)

    const endpoint = `/users/${id}/${tab}?page=${page}&limit=${PAGE_SIZE}`

    if (tab === 'questions') {
      api.get<Paginated<QuestionListItem>>(endpoint)
        .then((data) => {
          if (active) setQuestions(data)
        })
        .catch(() => {
          if (active) setError('Could not load questions.')
        })
        .finally(() => {
          if (active) setListLoading(false)
        })
    } else {
      api.get<Paginated<AnswerListItem>>(endpoint)
        .then((data) => {
          if (active) setAnswers(data)
        })
        .catch(() => {
          if (active) setError('Could not load answers.')
        })
        .finally(() => {
          if (active) setListLoading(false)
        })
    }

    return () => {
      active = false
    }
  }, [id, profile, tab, page])

  function changeTab(nextTab: Tab) {
    setTab(nextTab)
    setPage(1)
  }

  if (profileLoading) {
    return (
      <div className="ah-page max-w-[980px]" role="status" aria-label="Loading profile">
        <div className="ah-card flex items-center gap-5 rounded-[18px] p-6">
          <div className="ah-skeleton h-20 w-20 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-3">
            <div className="ah-skeleton h-7 w-48 max-w-full" />
            <div className="ah-skeleton h-4 w-32" />
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="ah-page max-w-[980px]">
        <ErrorState title="Profile unavailable" message={error ?? 'User not found.'} />
      </div>
    )
  }

  const isOwnProfile = user?.id === profile.id
  const currentList = tab === 'questions' ? questions : answers
  const totalPages = Math.max(
    1,
    Math.ceil((currentList?.total ?? 0) / PAGE_SIZE),
  )
  const stats: [string, number, boolean][] = [
    ['Questions', profile.question_count, false],
    ['Answers', profile.answer_count, false],
    ['Accepted', profile.accepted_answer_count, true],
  ]

  return (
    <div className="flex flex-1 flex-col">
      <div className="ah-page max-w-[980px] space-y-6">
        <section className="ah-card rounded-[18px] p-4 lg:p-6">
          <div className="grid grid-cols-[64px_minmax(0,1fr)] items-start gap-x-4 gap-y-4 sm:grid-cols-[80px_minmax(0,1fr)_auto] sm:gap-x-5">
            <span className="sm:hidden"><Avatar user={profile} size={64} /></span>
            <span className="hidden sm:block"><Avatar user={profile} size={80} /></span>

            <div className="min-w-0">
              <h1 className="break-words font-display text-[26px] font-bold leading-tight tracking-[-0.02em] text-ink lg:text-[30px]">
                {profile.username}
              </h1>

              <p className="mt-1 text-body-sm text-ink-faint">
                Joined {new Date(profile.created_at).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
              </p>

              {!profile.is_anonymized && profile.bio && (
                <p className="mt-3 whitespace-pre-wrap break-words text-[15px] leading-[1.6] text-ink-soft">
                  {profile.bio}
                </p>
              )}
            </div>

            <div className="col-span-2 flex flex-wrap gap-2 sm:col-span-1 sm:justify-end">
              {isOwnProfile ? (
                <Link to="/settings" className="ah-btn-secondary">
                  Edit profile
                </Link>
              ) : !profile.is_anonymized ? (
                <>
                  <Link to={`/messages/${profile.id}`} className="ah-btn-secondary">
                    Message
                  </Link>
                  <AddFriendButton
                    userId={profile.id}
                    friendship={profile.friendship}
                  />
                </>
              ) : null}
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-3 gap-3 border-t border-line4 pt-5">
            {stats.map(([label, count, highlight]) => (
              <div key={label} className="flex flex-col-reverse">
                <dt className="text-[12.5px] text-ink-faint">{label}</dt>
                <dd className={`font-display text-[26px] font-bold leading-tight tabular-nums ${highlight ? 'text-accent-dark' : 'text-ink'}`}>
                  {count}
                </dd>
              </div>
            ))}
          </dl>
        </section>

        <section>
          <div className="mb-4 flex gap-2" role="group" aria-label="Profile content">
            <button
              type="button"
              onClick={() => changeTab('questions')}
              aria-pressed={tab === 'questions'}
              className={`ah-pill ${tab === 'questions' ? 'ah-pill-active' : ''}`}
            >
              Questions
            </button>

            <button
              type="button"
              onClick={() => changeTab('answers')}
              aria-pressed={tab === 'answers'}
              className={`ah-pill ${tab === 'answers' ? 'ah-pill-active' : ''}`}
            >
              Answers
            </button>
          </div>

          {error && (
            <p role="alert" className="ah-alert mb-4">
              {error}
            </p>
          )}

          {listLoading ? (
            <SkeletonCards count={3} className="grid gap-3" />
          ) : tab === 'questions' ? (
            questions?.items.length ? (
              <ul className="grid gap-3">
                {questions.items.map((question) => (
                  <li key={question.id} className="min-w-0">
                    <QuestionCard question={question} excerpt={question.excerpt} />
                  </li>
                ))}
              </ul>
            ) : !error ? (
              <EmptyState title="No questions to display">
                {isOwnProfile ? 'Questions you ask will show up here.' : 'This member hasn\u2019t asked anything yet.'}
              </EmptyState>
            ) : null
          ) : answers?.items.length ? (
            <ul className="grid gap-3">
              {answers.items.map((answer) => (
                <li key={answer.id} className="min-w-0">
                  <article className="ah-card ah-card-hover relative flex flex-col gap-2 p-4 lg:p-[18px]">
                    <h3 className="break-words text-[15.5px] font-semibold leading-[1.4] tracking-[-0.01em] text-ink">
                      <Link
                        to={`/questions/${answer.question_id}`}
                        className="text-inherit no-underline after:absolute after:inset-0 after:rounded-2xl hover:text-accent-dark"
                      >
                        {answer.question_title}
                      </Link>
                    </h3>

                    <p className="line-clamp-2 break-words text-body leading-[1.55] text-ink-muted">
                      {answer.excerpt}
                    </p>

                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-meta text-ink-faint">
                      {answer.is_accepted ? (
                        <span className="ah-status ah-status-accepted"><span aria-hidden="true">✓</span> Accepted answer</span>
                      ) : (
                        <span className="ah-status">Answer</span>
                      )}
                      <span><span aria-hidden="true">▲ </span>{answer.vote_total}<span className="sr-only"> votes</span></span>
                      <span>{new Date(answer.created_at).toLocaleDateString()}</span>
                    </p>
                  </article>
                </li>
              ))}
            </ul>
          ) : !error ? (
            <EmptyState title="No answers to display">
              {isOwnProfile ? 'Answers you post will show up here.' : 'This member hasn\u2019t answered anything yet.'}
            </EmptyState>
          ) : null}
        </section>
      </div>
      {!listLoading && currentList && (
        <Pager page={page} totalPages={totalPages} onChange={setPage} label="Profile pagination" />
      )}
    </div>
  )
}
