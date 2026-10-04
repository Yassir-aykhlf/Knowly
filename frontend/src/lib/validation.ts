export const USERNAME_RE = /^[A-Za-z0-9_-]{3,30}$/

export function validatePassword(pw: string): string | null {
  if (pw.length < 8 || pw.length > 128) return 'Password must be 8–128 characters'
  if (!/[A-Za-z]/.test(pw)) return 'Password must contain a letter'
  if (!/[0-9]/.test(pw)) return 'Password must contain a digit'
  return null
}

export const BODY_MIN = 30
export const BODY_MAX = 30_000

export function validateBody(body: string): string | null {
  const length = body.trim().length
  if (length < BODY_MIN) return `Must be at least ${BODY_MIN} characters`
  if (length > BODY_MAX) return `Must be at most ${BODY_MAX.toLocaleString()} characters`
  return null
}

export const COMMENT_MAX = 1000

export function validateComment(body: string): string | null {
  const length = body.trim().length
  if (length === 0) return 'Comment cannot be empty'
  if (length > COMMENT_MAX) return `Must be at most ${COMMENT_MAX.toLocaleString()} characters`
  return null
}
