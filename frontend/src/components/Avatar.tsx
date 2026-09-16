import type { Author, User } from '../lib/types'

type AvatarUser = Pick<User | Author, 'username' | 'avatar_url'> & {
  is_anonymized?: boolean
}

type Props = {
  user: AvatarUser
  size?: number
}

const PALETTE = [
  '#2563eb',
  '#7c3aed',
  '#db2777',
  '#dc2626',
  '#ea580c',
  '#059669',
  '#0891b2',
  '#4f46e5',
]

function stableHash(value: string) {
  let hash = 2166136261

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

export default function Avatar({
  user,
  size = 32,
}: Props) {
  if (user.avatar_url && !user.is_anonymized) {
    return (
      <img
        src={user.avatar_url}
        alt=""
        width={size}
        height={size}
        className="inline-block rounded-full object-cover"
        style={{
          width: size,
          height: size,
        }}
        aria-hidden="true"
      />
    )
  }

  if (user.is_anonymized) {
    return (
      <span
        className="inline-flex items-center justify-center rounded-full bg-gray-400 text-white"
        style={{
          width: size,
          height: size,
          fontSize: size * 0.42,
        }}
        aria-hidden="true"
      >
        ?
      </span>
    )
  }

  const username = user.username || '?'
  const initials = username.slice(0, 2).toUpperCase()

  const backgroundColor =
    PALETTE[stableHash(username) % PALETTE.length]

  return (
    <span
      className="inline-flex items-center justify-center rounded-full text-white"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        backgroundColor,
      }}
      aria-hidden="true"
    >
      {initials}
    </span>
  )
}