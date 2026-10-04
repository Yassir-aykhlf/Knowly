import { Link } from 'react-router-dom'

import Avatar from './Avatar'
import { relativeTime } from '../lib/format'
import type { Author } from '../lib/types'

type Props = {
  author: Author
  createdAt: string
  updatedAt: string
  compact?: boolean
}

export default function PostMeta({ author, createdAt, updatedAt, compact = false }: Props) {
  const edited = new Date(updatedAt).getTime() > new Date(createdAt).getTime()

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      {!compact && <Avatar user={author} size={20} />}
      {author.is_anonymized ? (
        <span>{author.username}</span>
      ) : (
        <Link to={`/users/${author.id}`} className="font-medium text-slate-700 hover:underline">
          {author.username}
        </Link>
      )}
      <span>· {relativeTime(createdAt)}</span>
      {edited && <span title={`Edited ${relativeTime(updatedAt)}`}>· edited</span>}
    </span>
  )
}
