import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'

import AddFriendButton from '../components/AddFriendButton'
import Avatar from '../components/Avatar'
import QuestionCard from '../components/QuestionCard'
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
    return <p className="p-8 text-slate-500">Loading profile…</p>
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-4xl p-8">
        <p role="alert" className="text-red-600">
          {error ?? 'User not found.'}
        </p>
      </div>
    )
  }

  const isOwnProfile = user?.id === profile.id
  const currentList = tab === 'questions' ? questions : answers
  const totalPages = Math.max(
    1,
    Math.ceil((currentList?.total ?? 0) / PAGE_SIZE),
  )

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar user={profile} size={72} />

          <div className="min-w-0 flex-1">
            <h1 className="break-words text-2xl font-semibold">
              {profile.username}
            </h1>

            <p className="mt-1 text-sm text-slate-500">
              Joined {new Date(profile.created_at).toLocaleDateString()}
            </p>

            {!profile.is_anonymized && profile.bio && (
              <p className="mt-3 whitespace-pre-wrap break-words text-slate-700">
                {profile.bio}
              </p>
            )}
          </div>

          {isOwnProfile ? (
            <Link
              to="/settings"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium"
            >
              Edit profile
            </Link>
          ) : !profile.is_anonymized ? (
            <AddFriendButton
              userId={profile.id}
              friendship={profile.friendship}
            />
          ) : null}
        </div>

        <div className="mt-6 grid grid-cols-3 gap-3 border-t border-slate-200 pt-5">
          {[
            ['Questions', profile.question_count],
            ['Answers', profile.answer_count],
            ['Accepted', profile.accepted_answer_count],
          ].map(([label, count]) => (
            <div key={label} className="text-center">
              <p className="text-xl font-semibold">{count}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-5 flex gap-2 border-b border-slate-200 pb-3">
          <button
            type="button"
            onClick={() => changeTab('questions')}
            aria-pressed={tab === 'questions'}
            className={`rounded-md px-4 py-2 text-sm ${
              tab === 'questions'
                ? 'bg-accent font-semibold text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Questions
          </button>

          <button
            type="button"
            onClick={() => changeTab('answers')}
            aria-pressed={tab === 'answers'}
            className={`rounded-md px-4 py-2 text-sm ${
              tab === 'answers'
                ? 'bg-accent font-semibold text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            Answers
          </button>
        </div>

        {error && (
          <p role="alert" className="mb-4 text-sm text-red-600">
            {error}
          </p>
        )}

        {listLoading ? (
          <p className="text-sm text-slate-500">Loading…</p>
        ) : tab === 'questions' ? (
          questions?.items.length ? (
            <div>
              {questions.items.map((question) => (
                <QuestionCard key={question.id} question={question} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">
              No questions to display.
            </p>
          )
        ) : answers?.items.length ? (
          <div className="divide-y divide-slate-200">
            {answers.items.map((answer) => (
              <article key={answer.id} className="py-4">
                <Link
                  to={`/questions/${answer.question_id}`}
                  className="font-semibold text-accent hover:underline"
                >
                  {answer.question_title}
                </Link>

                <p className="mt-2 text-sm text-slate-600">
                  {answer.excerpt}
                </p>

                <p className="mt-2 text-xs text-slate-500">
                  {answer.vote_total} votes
                  {answer.is_accepted ? ' · Accepted answer' : ''}
                  {' · '}
                  {new Date(answer.created_at).toLocaleDateString()}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">
            No answers to display.
          </p>
        )}

        {!listLoading && currentList && totalPages > 1 && (
          <div className="mt-6 flex items-center justify-between border-t pt-4">
            <button
              type="button"
              disabled={page === 1}
              onClick={() => setPage((previous) => previous - 1)}
              className="rounded-md border px-3 py-2 text-sm disabled:opacity-40"
            >
              Previous
            </button>

            <span className="text-sm text-slate-500">
              Page {page} of {totalPages}
            </span>

            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((previous) => previous + 1)}
              className="rounded-md border px-3 py-2 text-sm disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
