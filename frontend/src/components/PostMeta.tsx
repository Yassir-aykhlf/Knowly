import { Link } from 'react-router-dom'

import Avatar from './Avatar'
import { relativeTime } from '../lib/format'
import type { Author } from '../lib/types'

type Props = {
  author: Author
  createdAt: string
  updatedAt: string
  compact?: boolean
  avatarSize?: number
  verb?: string
}

export default function PostMeta({ author, createdAt, updatedAt, compact = false, avatarSize = 20, verb }: Props) {
  const edited = new Date(updatedAt).getTime() > new Date(createdAt).getTime()

  return (
    <span className={`inline-flex flex-wrap items-center gap-x-1.5 text-ink-faint ${compact ? 'text-meta' : 'text-body-sm'}`}>
      {!compact && <Avatar user={author} size={avatarSize} />}
      {author.is_anonymized ? (
        <span className="font-medium">{author.username}</span>
      ) : (
        <Link to={`/users/${author.id}`} className="font-semibold text-ink-soft hover:text-accent-dark hover:underline">
          {author.username}
        </Link>
      )}
      <span>
        · {verb ? `${verb} ` : ''}
        {relativeTime(createdAt)}
      </span>
      {edited && <span title={`Edited ${relativeTime(updatedAt)}`}>· edited</span>}
    </span>
  )
}
