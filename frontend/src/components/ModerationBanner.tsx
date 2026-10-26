type Props = {
  status: string
  note?: string | null
  kind: 'question' | 'answer' | 'comment'
  compact?: boolean
}

const STYLES = {
  pending: {
    full: 'ah-banner-pending',
    compact: 'ah-banner-pending-compact',
  },
  rejected: {
    full: 'ah-banner-rejected',
    compact: 'ah-banner-rejected-compact',
  },
}

export default function ModerationBanner({ status, note, kind, compact = false }: Props) {
  if (status !== 'pending' && status !== 'rejected') return null

  const message =
    status === 'pending'
      ? `Your ${kind} is held for review. Only you can see it.`
      : `Your ${kind} was rejected by a moderator.`

  const cls = STYLES[status][compact ? 'compact' : 'full']

  return (
    <div
      role="status"
      className={cls}
    >
      <p className="font-medium">{message}</p>
      {note && <p className="mt-1">Reason: {note}</p>}
    </div>
  )
}