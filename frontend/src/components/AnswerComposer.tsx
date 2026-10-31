import { useState } from 'react'
import EditBox from './EditBox'
import FileUpload from './FileUpload'
import AttachmentList from './AttachmentList'
import { api } from '../lib/api'
import type { Answer } from '../lib/types'
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

  return (
    <section className="space-y-2">
      <h2 className="font-display text-title font-semibold tracking-[-0.02em] text-ink">Your answer</h2>
      {prefill?.isAiAssisted && (
        <p className="text-xs text-ai">
          Drafted with the AI assistant. This answer will be marked AI-assisted.
        </p>
      )}
      <FileUpload
        key={uploadVersion}
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
      {files.pending > 0 && <p role="status">Waiting for files…</p>}
      {/* a new prefill remounts the box, so it starts from the new text */}
      <EditBox
        key={prefill?.prefillBody ?? ''}
        initial={prefill?.prefillBody}
        validate={validateBody}
        max={BODY_MAX}
        rows={8}
        placeholder="Write your answer. Markdown is supported."
        submitLabel="Post your answer"
        onSubmit={post}
        disabled={files.blocked}
        resetOnSuccess
      />
    </section>
  )
}
