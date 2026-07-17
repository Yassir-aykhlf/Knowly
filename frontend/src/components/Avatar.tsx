// Avatar — STUB. For now it always renders initials on a coloured circle.
// Task A-09 makes it show the uploaded image when `avatar_url` is set.
import type { Author, User } from '../lib/types'

type Props = { user: Pick<User | Author, 'username' | 'avatar_url'>; size?: number }

export default function Avatar({ user, size = 32 }: Props) {
  const initials = (user.username || '?').slice(0, 2).toUpperCase()
  return (
    <span
      className="inline-flex items-center justify-center rounded-full bg-accent text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {initials}
    </span>
  )
}
