import { FormEvent, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'

import { ApiError } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import GoogleButton from '../components/GoogleButton'

const OAUTH_ERRORS = new Set([
  'unconfigured',
  'state',
  'provider',
  'unverified',
  'conflict',
])

export default function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [oauthHint, setOauthHint] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const oauthError = searchParams.get('oauth_error')
  const showOauthError =
    oauthError !== null && OAUTH_ERRORS.has(oauthError)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError(null)
    setFieldErrors({})
    setOauthHint(false)
    setIsSubmitting(true)

    try {
      await login(email, password)
      navigate('/home', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message)
        setFieldErrors(err.fields ?? {})
        setOauthHint(err.fields?.oauth_hint === 'true')
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.03em] text-ink">Sign in</h1>
      <p className="ah-lead mt-2">Sign in to continue to Knowly.</p>

      <div className="mt-7 space-y-4">
        {showOauthError && (
          <div role="alert" className="ah-alert-warn">
            We couldn&apos;t sign you in with Google. Please try again or sign in
            with your email and password.
          </div>
        )}

        {error && (
          <div role="alert" className="ah-alert">
            <p>{error}</p>
            {oauthHint && (
              <p className="mt-2">
                If you signed up with Google, use the Google button.
              </p>
            )}
          </div>
        )}

        <GoogleButton />

        <div className="flex items-center gap-3" role="separator">
          <div className="h-px flex-1 bg-line" />
          <span className="text-meta text-ink-faint">or with email</span>
          <div className="h-px flex-1 bg-line" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="ah-label">
              Email
            </label>
            <input
              id="login-email"
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
            <label htmlFor="login-password" className="ah-label">
              Password
            </label>
            <input
              id="login-password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              className="ah-input"
              required
            />
            {fieldErrors.password && (
              <p className="ah-error">{fieldErrors.password}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="ah-btn-primary h-[46px] w-full rounded-[11px] lg:h-[46px]"
          >
            {isSubmitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>

      <p className="mt-7 text-center text-body text-ink-muted">
        New to Knowly?{' '}
        <Link
          to="/register"
          state={{ from: location.state?.from }}
          className="ah-link font-semibold"
        >
          Create an account
        </Link>
      </p>
    </div>
  )
}
