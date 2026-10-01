type Props = {
  status: string
  note?: string | null
  kind: 'question' | 'answer' | 'comment'
  compact?: boolean
}

const STYLES = {
  pending: 'border-amber-300 bg-amber-50 text-amber-800',
  rejected: 'border-red-300 bg-red-50 text-red-800',
}

export default function ModerationBanner({ status, note, kind, compact = false }: Props) {
  if (status !== 'pending' && status !== 'rejected') return null

  const message =
    status === 'pending'
      ? `Your ${kind} is held for review. Only you can see it.`
      : `Your ${kind} was rejected by a moderator.`

  return (
    <div
      role="status"
      className={`rounded-md border ${STYLES[status]} ${compact ? 'px-2 py-1 text-xs' : 'px-4 py-3 text-sm'}`}
    >
      <p className="font-medium">{message}</p>
      {note && <p className="mt-1">Reason: {note}</p>}
    </div>
  )
}