import type { ReactNode } from 'react'
import { Link, useLocation } from 'react-router-dom'

import Avatar from './Avatar'
import { relativeTime } from '../lib/format'
import type { QuestionListItem } from '../lib/types'

type CardQuestion = Pick<
  QuestionListItem,
  | 'id'
  | 'title'
  | 'tags'
  | 'author'
  | 'vote_total'
  | 'answer_count'
  | 'view_count'
  | 'has_accepted_answer'
  | 'created_at'
>

type Props = {
  question: CardQuestion
  excerpt?: ReactNode
}

export function AnswerStatus({
  count,
  accepted,
}: {
  count: number
  accepted: boolean
}) {
  if (accepted) {
    return (
      <span className="ah-status ah-status-accepted">
        <span aria-hidden="true">✓</span>
        {count} {count === 1 ? 'answer' : 'answers'}
        <span className="sr-only">, one accepted</span>
      </span>
    )
  }
  if (count === 0) return <span className="ah-status ah-status-warn">Unanswered</span>
  return (
    <span className="ah-status">
      {count} {count === 1 ? 'answer' : 'answers'}
    </span>
  )
}

export default function QuestionCard({ question, excerpt }: Props) {
  const location = useLocation()
  const { id, title, tags, author, vote_total, answer_count, view_count, has_accepted_answer, created_at } =
    question

  return (
    <article className="ah-card ah-card-hover relative flex h-full flex-col gap-2.5 p-4 lg:p-[18px]">
      <div className="flex min-w-0 items-center gap-2 text-meta text-ink-faint">
        <Avatar user={author} size={20} />
        <span className="truncate font-medium text-ink-soft">{author.username}</span>
        <time dateTime={created_at} className="shrink-0">
          · {relativeTime(created_at)}
        </time>
      </div>

      <h3 className="break-words text-[15.5px] font-semibold leading-[1.4] tracking-[-0.01em] text-ink">
        <Link
          to={`/questions/${id}`}
          state={{ from: `${location.pathname}${location.search}` }}
          className="text-inherit no-underline after:absolute after:inset-0 after:rounded-2xl hover:text-accent-dark focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent"
        >
          {title}
        </Link>
      </h3>

      {excerpt && (
        <p className="line-clamp-2 break-words text-body leading-[1.55] text-ink-muted">{excerpt}</p>
      )}

      <div className="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1.5 pt-1 text-meta text-ink-faint">
        <AnswerStatus count={answer_count} accepted={has_accepted_answer} />
        <span className="whitespace-nowrap">
          <span aria-hidden="true">▲ </span>
          {vote_total}
          <span className="sr-only"> {vote_total === 1 ? 'vote' : 'votes'}</span>
        </span>
        <span className="whitespace-nowrap">
          {view_count} {view_count === 1 ? 'view' : 'views'}
        </span>
        {tags.length > 0 && (
          <span className="min-w-0 truncate font-mono text-[11px]" aria-label={`Tags: ${tags.join(', ')}`}>
            {tags.join(' · ')}
          </span>
        )}
      </div>
    </article>
  )
}
