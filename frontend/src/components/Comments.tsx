import { useState } from 'react'

import EditBox from './EditBox'
import ModerationBanner from './ModerationBanner'
import PostMeta from './PostMeta'
import { api, ApiError } from '../lib/api'
import type { Comment, ParentType } from '../lib/types'
import { COMMENT_MAX, validateComment } from '../lib/validation'
import { useToast } from '../contexts/ToastContext'

type Props = {
  parentType: ParentType
  parentId: string
  comments: Comment[]
  viewerId: string | undefined
  onChanged: () => void
}

export default function Comments({ parentType, parentId, comments, viewerId, onChanged }: Props) {
  const [adding, setAdding] = useState(false)

  async function add(body: string) {
    await api.post<Comment>('/comments', { parent_type: parentType, parent_id: parentId, body })
    setAdding(false)
    onChanged()
  }

  return (
    <div className="border-t border-slate-100 pt-2">
      {comments.length > 0 && (
        <ul className="divide-y divide-slate-100">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              isMine={comment.author.id === viewerId}
              onChanged={onChanged}
            />
          ))}
        </ul>
      )}

      {adding ? (
        <div className="pt-2">
          <EditBox
            validate={validateComment}
            max={COMMENT_MAX}
            rows={2}
            placeholder="Add a comment…"
            submitLabel="Add comment"
            onSubmit={add}
            onCancel={() => setAdding(false)}
            autoFocus
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-1 text-xs text-slate-500 hover:text-accent"
        >
          Add a comment
        </button>
      )}
    </div>
  )
}

type ItemProps = {
  comment: Comment
  isMine: boolean
  onChanged: () => void
}

function CommentItem({ comment, isMine, onChanged }: ItemProps) {
  const { showToast } = useToast()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState(false)

  async function save(body: string) {
    await api.put<Comment>(`/comments/${comment.id}`, { body })
    setEditing(false)
    onChanged()
  }

  async function remove() {
    if (!window.confirm('Delete this comment?')) return
    setBusy(true)
    try {
      await api.del(`/comments/${comment.id}`)
      onChanged()
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Something went wrong', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <li className="space-y-1 py-2 text-sm">
      {isMine && (
        <ModerationBanner
          status={comment.moderation_status}
          note={comment.moderation_note}
          kind="comment"
          compact
        />
      )}

      {editing ? (
        <EditBox
          initial={comment.body}
          validate={validateComment}
          max={COMMENT_MAX}
          rows={2}
          submitLabel="Save"
          onSubmit={save}
          onCancel={() => setEditing(false)}
          autoFocus
        />
      ) : (
        <p className="whitespace-pre-wrap break-words text-slate-700">
          {comment.body}{' '}
          <PostMeta
            author={comment.author}
            createdAt={comment.created_at}
            updatedAt={comment.updated_at}
            compact
          />
          {isMine && (
            <span className="ml-2 inline-flex gap-2 text-xs">
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
            </span>
          )}
        </p>
      )}
    </li>
  )
}
