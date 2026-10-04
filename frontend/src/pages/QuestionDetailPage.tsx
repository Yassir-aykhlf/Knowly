import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import AnswerComposer, { readPrefill } from '../components/AnswerComposer'
import AnswerItem, { SELF_VOTE_REASON } from '../components/AnswerItem'
import AttachmentList from '../components/AttachmentList'
import Comments from '../components/Comments'
import MarkdownBody from '../components/MarkdownBody'
import ModerationBanner from '../components/ModerationBanner'
import PostMeta from '../components/PostMeta'
import VoteArrows from '../components/VoteArrows'
import { api, ApiError } from '../lib/api'
import type { Question } from '../lib/types'
import { useAuth } from '../contexts/AuthContext'
import { useToast } from '../contexts/ToastContext'

export default function QuestionDetailPage() {
  const { id = '' } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { showToast } = useToast()

  const [question, setQuestion] = useState<Question | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const prefill = readPrefill(location.state)

  const load = useCallback(async () => {
    setError(null)
    try {
      setQuestion(await api.get<Question>(`/questions/${id}`))
      setNotFound(false)
    } catch (err) {
      if (err instanceof ApiError && err.status === 404) {
        setNotFound(true)
      } else {
        setError(err instanceof ApiError ? err.message : 'Something went wrong.')
      }
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    setLoading(true)
    setQuestion(null)
    void load()
  }, [load])

  function handleAnswerPosted() {
    if (prefill) navigate(location.pathname, { replace: true, state: null })
    void load()
  }

  async function deleteQuestion() {
    if (!question) return
    if (!window.confirm('Delete this question, with all its answers and comments?')) return
    try {
      await api.del(`/questions/${question.id}`)
      showToast('Question deleted')
      navigate('/home')
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Something went wrong', 'error')
    }
  }

  if (loading) {
    return <div className="px-4 py-10 text-center text-sm text-slate-500">Loading…</div>
  }

  if (notFound) {
    return (
      <div className="px-4 py-10 text-center text-sm text-slate-600">
        <p className="mb-3">This question doesn't exist, or you can't see it.</p>
        <Link to="/home" className="text-accent hover:underline">Back to questions</Link>
      </div>
    )
  }

  if (!question) {
    return (
      <div className="px-4 py-10 text-center text-sm text-red-700">
        <p className="mb-3">{error ?? 'Something went wrong.'}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true)
            void load()
          }}
          className="rounded-md border px-3 py-1"
        >
          Retry
        </button>
      </div>
    )
  }

  const viewerId = user?.id
  const isAsker = question.author.id === viewerId
  const answerCount = question.answers.length

  return (
    <div className="mx-auto max-w-3xl space-y-8 px-4 py-8">
      {error && (
        <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Couldn't refresh: {error}{' '}
          <button type="button" onClick={() => void load()} className="underline">
            Retry
          </button>
        </p>
      )}

      <article className="flex gap-4">
        <VoteArrows
          targetType="question"
          targetId={question.id}
          total={question.vote_total}
          myVote={question.my_vote}
          disabled={isAsker}
          disabledReason={SELF_VOTE_REASON}
        />

        <div className="min-w-0 flex-1 space-y-4">
          {isAsker && (
            <ModerationBanner
              status={question.moderation_status}
              note={question.moderation_note}
              kind="question"
            />
          )}

          <h1 className="break-words text-2xl font-semibold">{question.title}</h1>
          <MarkdownBody markdown={question.body} />

          {question.tags.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {question.tags.map((tag) => (
                <li key={tag} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">
                  {tag}
                </li>
              ))}
            </ul>
          )}

          <AttachmentList items={question.attachments} />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-3 text-sm">
              {isAsker && (
                <>
                  <Link to={`/questions/${question.id}/edit`} className="text-slate-500 hover:text-accent">
                    Edit
                  </Link>
                  <button
                    type="button"
                    onClick={() => void deleteQuestion()}
                    className="text-slate-500 hover:text-red-600"
                  >
                    Delete
                  </button>
                </>
              )}
            </div>
            <PostMeta
              author={question.author}
              createdAt={question.created_at}
              updatedAt={question.updated_at}
            />
          </div>

          <Comments
            parentType="question"
            parentId={question.id}
            comments={question.comments}
            viewerId={viewerId}
            onChanged={load}
          />
        </div>
      </article>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">
          {answerCount} {answerCount === 1 ? 'answer' : 'answers'}
        </h2>
        {/* rendered in server order: accepted first, then votes, then oldest. Never re-sort here. */}
        {question.answers.map((answer) => (
          <AnswerItem
            key={answer.id}
            answer={answer}
            questionId={question.id}
            isAccepted={answer.id === question.accepted_answer_id}
            viewerIsAsker={isAsker}
            viewerId={viewerId}
            onChanged={load}
          />
        ))}
      </section>

      <AnswerComposer questionId={question.id} prefill={prefill} onPosted={handleAnswerPosted} />
    </div>
  )
}
