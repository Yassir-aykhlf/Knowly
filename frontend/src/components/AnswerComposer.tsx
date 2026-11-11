import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import EditBox from './EditBox'
import NavIcon from './NavIcon'
import { useToast } from '../contexts/ToastContext'
import FileUpload from './FileUpload'
import AttachmentList from './AttachmentList'
import { api, ApiError } from '../lib/api'
import type { AiConversation, Answer } from '../lib/types'
import { BODY_MAX, validateBody } from '../lib/validation'
import { useAttachments } from '../hooks/useAttachments'

export type AnswerPrefill = {
  prefillBody: string
  fromConversationId: string | null
  isAiAssisted: boolean
}

export function readPrefill(state: unknown): AnswerPrefill | null {
  if (typeof state !== 'object' || state === null) return null
  const s = state as Record<string, unknown>
  if (typeof s.prefillBody !== 'string') return null
  return {
    prefillBody: s.prefillBody,
    fromConversationId: typeof s.fromConversationId === 'string' ? s.fromConversationId : null,
    isAiAssisted: s.isAiAssisted === true,
  }
}

type Props = {
  questionId: string
  prefill: AnswerPrefill | null
  onPosted: () => void
}

export default function AnswerComposer({ questionId, prefill, onPosted }: Props) {
  const files = useAttachments()
  const [uploadVersion, setUploadVersion] = useState(0)
  const [drafting, setDrafting] = useState(false)
  const navigate = useNavigate()
  const { showToast } = useToast()

  async function post(body: string) {
    await files.submit((attachment_ids) =>
      api.post<Answer>(`/questions/${questionId}/answers`, {
        body,
        is_ai_assisted: prefill?.isAiAssisted ?? false,
        from_conversation_id: prefill?.fromConversationId ?? null,
        attachment_ids,
      }),
    )
    files.replace([])
    setUploadVersion((value) => value + 1)
    onPosted()
  }

  async function draftWithAi() {
    if (drafting) return
    setDrafting(true)
    try {
      const conversation = await api.post<AiConversation>('/ai/conversations', { question_id: questionId })
      navigate(`/ai/${conversation.id}`)
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not start an AI conversation.', 'error')
      setDrafting(false)
    }
  }

  return (
    <section className="space-y-3" aria-labelledby="your-answer-heading">
      <h2 id="your-answer-heading" className="ah-h2">Your answer</h2>
      {prefill?.isAiAssisted && (
        <p className="rounded-btn border border-ai-line bg-ai-wash px-3.5 py-2.5 text-body-sm text-ai">
          Drafted with the AI assistant. This answer will be marked AI-assisted.
        </p>
      )}
      {/* a new prefill remounts the box, so it starts from the new text */}
      <EditBox
        key={prefill?.prefillBody ?? ''}
        initial={prefill?.prefillBody}
        validate={validateBody}
        max={BODY_MAX}
        rows={8}
        label="Your answer"
        placeholder="Write your answer. Markdown is supported."
        submitLabel="Post answer"
        onSubmit={post}
        disabled={files.blocked}
        resetOnSuccess
        extraActions={
          <button type="button" onClick={() => void draftWithAi()} disabled={drafting} className="ah-btn-ai">
            <NavIcon name="ai" size={16} />
            {drafting ? 'Opening…' : 'Draft with AI'}
          </button>
        }
      >
        <FileUpload
          key={uploadVersion}
          attachmentCount={files.items.length}
          onUploaded={files.add}
          beginOperation={files.beginOperation}
          disabled={files.submitting}
        />
        <AttachmentList
          items={files.items}
          onDelete={files.remove}
          beginOperation={files.beginOperation}
          disabled={files.submitting}
        />
        {files.pending > 0 && <p role="status" className="text-body-sm text-ink-muted">Waiting for files…</p>}
      </EditBox>
    </section>
  )
}
