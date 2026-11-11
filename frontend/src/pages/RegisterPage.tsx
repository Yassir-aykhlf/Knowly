import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ApiError } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { USERNAME_RE, validatePassword } from '../lib/validation'
import GoogleButton from '../components/GoogleButton'

export default function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  function validateForm(): Record<string, string> {
    const errors: Record<string, string> = {}

    if (!email.trim()) {
      errors.email = 'Email is required'
    }

    if (!USERNAME_RE.test(username)) {
      errors.username =
        'Username must be 3–30 characters using letters, numbers, _ or -'
    }

    const passwordError = validatePassword(password)
    if (passwordError) {
      errors.password = passwordError
    }

    return errors
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setFormError(null)

    const clientErrors = validateForm()

    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors)
      return
    }

    setFieldErrors({})
    setIsSubmitting(true)

    try {
      await register(email, username, password)
      navigate('/home', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message)
        setFieldErrors(err.fields ?? {})
      } else {
        setFormError('Something went wrong. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.03em] text-ink">Create your account</h1>
      <p className="ah-lead mt-2">Join Knowly and start learning with the community.</p>

      <div className="mt-7 space-y-4">
        {formError && (
          <div role="alert" className="ah-alert">
            {formError}
          </div>
        )}

        <GoogleButton />

        <div className="flex items-center gap-3" role="separator">
          <div className="h-px flex-1 bg-line" />
          <span className="text-meta text-ink-faint">or with email</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <div>
            <label htmlFor="register-username" className="ah-label">
              Username
            </label>
            <input
              id="register-username"
              name="username"
              type="text"
              autoComplete="username"
              placeholder="3–30 letters, numbers, _ or -"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              aria-invalid={Boolean(fieldErrors.username)}
              className="ah-input"
              required
            />
            {fieldErrors.username && (
              <p className="ah-error">{fieldErrors.username}</p>
            )}
          </div>

          <div>
            <label htmlFor="register-email" className="ah-label">
              Email
            </label>
            <input
              id="register-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
              className="ah-input"
              required
            />
            {fieldErrors.email && (
              <p className="ah-error">{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label htmlFor="register-password" className="ah-label">
              Password
            </label>
            <input
              id="register-password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby="register-password-help"
              className="ah-input"
              required
            />
            <p id="register-password-help" className="ah-help">
              8–128 characters, with at least one letter and one digit
            </p>
            {fieldErrors.password && (
              <p className="ah-error">{fieldErrors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="ah-btn-primary h-[46px] w-full rounded-[11px] lg:h-[46px]"
          >
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>
      </div>

      <p className="mt-7 text-center text-body text-ink-muted">
        Already have an account?{' '}
        <Link to="/login" className="ah-link font-semibold">
          Sign in
        </Link>
      </p>
    </div>
  )
}
