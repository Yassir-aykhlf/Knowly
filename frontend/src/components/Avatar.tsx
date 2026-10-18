import type { Author, User } from '../lib/types'

type AvatarUser = Pick<
  User | Author,
  'username' | 'avatar_url' | 'is_anonymized'
>

type Props = {
  user: AvatarUser
  size?: number
}

const PALETTE = [
  '#2563eb',
  '#7c3aed',
  '#0f766e',
  '#b45309',
  '#be185d',
  '#475569',
  '#0369a1',
  '#4d7c0f',
]

function stableColor(username: string): string {
  let hash = 2166136261

  for (let i = 0; i < username.length; i++) {
    hash ^= username.charCodeAt(i)
    hash = Math.imul(hash, 16777619) >>> 0
  }

  return PALETTE[hash % PALETTE.length]
}

export default function Avatar({
  user,
  size = 32,
}: Props) {
  const anonymized = user.is_anonymized

  const initials = (
    user.username.trim() || '?'
  ).slice(0, 2).toUpperCase()

  const style = {
    width: size,
    height: size,
    fontSize: size * 0.4,
    backgroundColor: anonymized
      ? '#64748b'
      : stableColor(user.username),
  }

  if (!anonymized && user.avatar_url) {
    return (
      <img
        src={user.avatar_url}
        alt={`${user.username}'s avatar`}
        width={size}
        height={size}
        className="inline-block shrink-0 rounded-full object-cover"
        style={{
          width: size,
          height: size,
        }}
      />
    )
  }

  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white"
      style={style}
      role="img"
      aria-label={
        anonymized
          ? 'Anonymized user'
          : `${user.username} avatar`
      }
    >
      {anonymized ? '?' : initials}
    </span>
  )
}