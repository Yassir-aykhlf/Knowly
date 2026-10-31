import { useEffect, useState } from 'react'

import AttachmentList from './AttachmentList'
import Comments from './Comments'
import EditBox from './EditBox'
import MarkdownBody from './MarkdownBody'
import ModerationBanner from './ModerationBanner'
import PostMeta from './PostMeta'
import VoteArrows from './VoteArrows'
import { api, ApiError } from '../lib/api'
import type { Answer } from '../lib/types'
import { BODY_MAX, validateBody } from '../lib/validation'
import { useToast } from '../contexts/ToastContext'
import { useAttachments } from '../hooks/useAttachments'

export const SELF_VOTE_REASON = "You can't vote on your own post"

type Props = {
  answer: Answer
  questionId: string
  isAccepted: boolean
  viewerIsAsker: boolean
  viewerId: string | undefined
  onChanged: () => void
}

export default function AnswerItem({
  answer,
  questionId,
  isAccepted,
  viewerIsAsker,
  viewerId,
  onChanged,
}: Props) {
  const { showToast } = useToast()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)
  const isMine = answer.author.id === viewerId
  const canAccept = viewerIsAsker && answer.moderation_status === 'approved'
  const files = useAttachments(answer.attachments)

  useEffect(() => {
    files.replace(answer.attachments)
  }, [answer.attachments, files.replace])

  async function toggleAccept() {
    setBusy(true)
    try {
      await api.post(`/questions/${questionId}/accept-answer`, {
        answer_id: isAccepted ? null : answer.id,
      })
      onChanged()
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Something went wrong', 'error')
    } finally {
      setBusy(false)
    }
  }

  async function save(body: string) {
    await files.submit((attachment_ids) =>
      api.put<Answer>(`/answers/${answer.id}`, { body, attachment_ids }),
    )
    setEditing(false)
    onChanged()
  }

  async function remove() {
    if (!window.confirm('Delete your answer? Its comments and votes go with it.')) return
    setBusy(true)
    try {
      await api.del(`/answers/${answer.id}`)
      onChanged()
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Something went wrong', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <article
      className={`flex gap-[18px] rounded-card border p-5 ${
        isAccepted ? 'border-accent bg-[rgba(13,148,136,0.04)]' : 'border-line'
      }`}
    >
      <VoteArrows
        targetType="answer"
        targetId={answer.id}
        total={answer.vote_total}
        myVote={answer.my_vote}
        disabled={isMine}
        disabledReason={SELF_VOTE_REASON}
      />

      <div className="min-w-0 flex-1 space-y-3">
        {isMine && (
          <ModerationBanner
            status={answer.moderation_status}
            note={answer.moderation_note}
            kind="answer"
          />
        )}

        <div className="flex flex-wrap items-center gap-2">
          {canAccept ? (
            <button
              type="button"
              onClick={() => void toggleAccept()}
              disabled={busy}
              aria-pressed={isAccepted}
              className={`disabled:opacity-50 ${
                isAccepted
                  ? 'ah-badge-accepted'
                  : 'inline-flex cursor-pointer items-center rounded-badge border border-line3 px-3 py-[3px] font-mono text-tag font-bold uppercase tracking-[0.02em] text-ink-faint hover:border-accent hover:text-accent'
              }`}
            >
              {isAccepted ? '✓ Accepted' : 'Accept'}
            </button>
          ) : (
            isAccepted && (
              <span className="ah-badge-accepted">✓ Accepted</span>
            )
          )}
          {answer.is_ai_assisted && (
            <span className="ah-badge-ai">AI-assisted</span>
          )}
        </div>

        {editing ? (
          <EditBox
            initial={answer.body}
            validate={validateBody}
            max={BODY_MAX}
            rows={8}
            submitLabel="Save"
            onSubmit={save}
            onCancel={() => setEditing(false)}
            disabled={files.blocked || busy}
            autoFocus
          />
        ) : (
          <MarkdownBody markdown={answer.body} />
        )}

        <AttachmentList
          items={files.items}
          onDelete={isMine ? files.remove : undefined}
          beginOperation={files.beginOperation}
          disabled={files.submitting || busy}
        />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-3 text-body-sm">
            {isMine && !editing && (
              <>
                <button type="button" onClick={() => setEditing(true)} className="text-ink-faint hover:text-accent">
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void remove()}
                  disabled={busy}
                  className="text-ink-faint hover:text-red-600"
                >
                  Delete
                </button>
              </>
            )}
          </div>
          <PostMeta author={answer.author} createdAt={answer.created_at} updatedAt={answer.updated_at} />
        </div>

        <Comments
          parentType="answer"
          parentId={answer.id}
          comments={answer.comments}
          viewerId={viewerId}
          onChanged={onChanged}
        />
      </div>
    </article>
  )
}
