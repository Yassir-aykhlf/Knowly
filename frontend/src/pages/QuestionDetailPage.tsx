import { useCallback, useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'

import AnswerComposer, { readPrefill } from '../components/AnswerComposer'
import AnswerItem, { SELF_VOTE_REASON } from '../components/AnswerItem'
import AttachmentList from '../components/AttachmentList'
import BackButton from '../components/BackButton'
import { EmptyState, ErrorState } from '../components/StateBlocks'
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
    if (prefill) navigate(location.pathname, { replace: true, state: from ? { from } : null })
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

  const from = readFrom(location.state)
  const backTo = from ?? '/home'
  const backLabel = from?.startsWith('/search') ? 'Back to results' : 'Back to questions'

  if (loading) {
    return (
      <div className="ah-page max-w-[840px]" role="status" aria-label="Loading question">
        <div className="ah-skeleton h-9 w-40" />
        <div className="ah-skeleton mt-6 h-9 w-11/12" />
        <div className="ah-skeleton mt-3 h-9 w-2/3" />
        <div className="ah-skeleton mt-8 h-4 w-full" />
        <div className="ah-skeleton mt-3 h-4 w-full" />
        <div className="ah-skeleton mt-3 h-4 w-3/4" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="ah-page max-w-[840px]">
        <EmptyState
          title="Question not found"
          action={<BackButton to={backTo} label={backLabel} />}
        >
          This question doesn&apos;t exist, or you can&apos;t see it.
        </EmptyState>
      </div>
    )
  }

  if (!question) {
    return (
      <div className="ah-page max-w-[840px]">
        <ErrorState
          title="Couldn't load this question"
          message={error ?? 'Something went wrong.'}
          onRetry={() => {
            setLoading(true)
            void load()
          }}
        />
      </div>
    )
  }

  const viewerId = user?.id
  const isAsker = question.author.id === viewerId
  const answerCount = question.answers.length

  return (
    <div className="ah-page max-w-[840px] space-y-6">
      <BackButton to={backTo} label={backLabel} />

      {error && (
        <p className="ah-alert" role="alert">
          Couldn’t refresh: {error}{' '}
          <button type="button" onClick={() => void load()} className="font-semibold underline">
            Retry
          </button>
        </p>
      )}

      <article className="space-y-5">
        {isAsker && (
          <ModerationBanner
            status={question.moderation_status}
            note={question.moderation_note}
            kind="question"
          />
        )}

        <header className="space-y-3">
          {question.tags.length > 0 && (
            <ul className="flex flex-wrap gap-1.5" aria-label="Tags">
              {question.tags.map((tag) => (
                <li key={tag}>
                  <Link to={`/search?tag=${encodeURIComponent(tag)}`} className="ah-tag no-underline hover:text-accent-dark">
                    {tag}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <h1 className="text-balance break-words font-display text-[26px] font-bold leading-[1.15] tracking-[-0.03em] text-ink lg:text-[36px]">
            {question.title}
          </h1>
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-body-sm text-ink-faint">
            <PostMeta
              author={question.author}
              createdAt={question.created_at}
              updatedAt={question.updated_at}
              avatarSize={24}
              verb="asked"
            />
            <span>
              · {question.view_count} {question.view_count === 1 ? 'view' : 'views'}
            </span>
          </div>
        </header>

        <MarkdownBody markdown={question.body} />

        <AttachmentList
          items={question.attachments}
          onDelete={
            isAsker
              ? (attachmentId) =>
                  setQuestion((current) =>
                    current
                      ? {
                          ...current,
                          attachments: current.attachments.filter(
                            (attachment) => attachment.id !== attachmentId,
                          ),
                        }
                      : current,
                  )
              : undefined
          }
        />

        <div className="flex flex-wrap items-center justify-between gap-3">
          <VoteArrows
            targetType="question"
            targetId={question.id}
            total={question.vote_total}
            myVote={question.my_vote}
            disabled={isAsker}
            disabledReason={SELF_VOTE_REASON}
          />
          {isAsker && (
            <div className="flex gap-4">
              <Link to={`/questions/${question.id}/edit`} className="ah-text-btn no-underline">
                Edit
              </Link>
              <button type="button" onClick={() => void deleteQuestion()} className="ah-text-btn-danger">
                Delete
              </button>
            </div>
          )}
        </div>

        <Comments
          parentType="question"
          parentId={question.id}
          comments={question.comments}
          viewerId={viewerId}
          onChanged={load}
        />
      </article>

      <section className="space-y-3.5" aria-labelledby="answers-heading">
        <h2 id="answers-heading" className="ah-h2 flex items-center gap-2.5">
          Answers
          <span className="ah-status font-sans">{answerCount}</span>
        </h2>
        {answerCount === 0 && (
          <EmptyState title="No answers yet">Know something that helps? Be the first to answer.</EmptyState>
        )}
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

// Where the reader came from (set by QuestionCard), so Back returns there.
function readFrom(state: unknown): string | null {
  if (typeof state !== 'object' || state === null) return null
  const from = (state as Record<string, unknown>).from
  return typeof from === 'string' && from.startsWith('/') ? from : null
}
