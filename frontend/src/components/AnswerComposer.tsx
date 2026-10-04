import EditBox from './EditBox'
import { api } from '../lib/api'
import type { Answer } from '../lib/types'
import { BODY_MAX, validateBody } from '../lib/validation'

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
  async function post(body: string) {
    await api.post<Answer>(`/questions/${questionId}/answers`, {
      body,
      is_ai_assisted: prefill?.isAiAssisted ?? false,
      from_conversation_id: prefill?.fromConversationId ?? null,
      attachment_ids: [],
    })
    onPosted()
  }

  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold">Your answer</h2>
      {prefill?.isAiAssisted && (
        <p className="text-xs text-violet-700">
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
        placeholder="Write your answer. Markdown is supported."
        submitLabel="Post your answer"
        onSubmit={post}
        resetOnSuccess
      />
    </section>
  )
}
