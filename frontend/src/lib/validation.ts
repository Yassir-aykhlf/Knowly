// Client-side mirrors of the backend validation rules, so forms can give instant
// feedback. The backend is still the source of truth.
export const USERNAME_RE = /^[A-Za-z0-9_-]{3,30}$/

export function validatePassword(pw: string): string | null {
  if (pw.length < 8 || pw.length > 128) return 'Password must be 8–128 characters'
  if (!/[A-Za-z]/.test(pw)) return 'Password must contain a letter'
  if (!/[0-9]/.test(pw)) return 'Password must contain a digit'
  return null
}
