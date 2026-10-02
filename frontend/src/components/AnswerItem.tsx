import { useState } from 'react'

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
    await api.put<Answer>(`/answers/${answer.id}`, {
      body,
      attachment_ids: answer.attachments.map((a) => a.id),
    })
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
      className={`flex gap-4 rounded-lg border p-4 ${
        isAccepted ? 'border-green-300 bg-green-50/50' : 'border-slate-200'
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

        <div className="flex flex-wrap items-center gap-2 text-xs font-medium">
          {canAccept ? (
            <button
              type="button"
              onClick={() => void toggleAccept()}
              disabled={busy}
              aria-pressed={isAccepted}
              className={`rounded-full border px-2.5 py-0.5 disabled:opacity-50 ${
                isAccepted
                  ? 'border-green-600 bg-green-600 text-white'
                  : 'border-slate-300 text-slate-600 hover:border-green-600 hover:text-green-700'
              }`}
            >
              {isAccepted ? '✓ Accepted' : 'Accept'}
            </button>
          ) : (
            isAccepted && (
              <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-green-800">✓ Accepted</span>
            )
          )}
          {answer.is_ai_assisted && (
            <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-violet-800">AI-assisted</span>
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
            autoFocus
          />
        ) : (
          <MarkdownBody markdown={answer.body} />
        )}

        <AttachmentList items={answer.attachments} />

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-3 text-sm">
            {isMine && !editing && (
              <>
                <button type="button" onClick={() => setEditing(true)} className="text-slate-500 hover:text-accent">
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => void remove()}
                  disabled={busy}
                  className="text-slate-500 hover:text-red-600"
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
