
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { api, ApiError } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'

export default function AuthLinkPage() {
  const navigate = useNavigate()
  const { refresh } = useAuth()

  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isExpired, setIsExpired] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCancelling, setIsCancelling] = useState(false)

  async function handleLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setError(null)
    setIsSubmitting(true)

    try {
      await api.post('/auth/google/link', { password })
      await refresh()
      navigate('/home', { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'link_expired') {
          setIsExpired(true)
          setError('Your Google linking request has expired.')
        } else if (err.code === 'invalid_credentials') {
          setError('Incorrect password. Please try again.')
        } else if (err.code === 'link_invalid') {
          setError('This account cannot be linked to Google.')
        } else if (err.code === 'conflict') {
          setError('This Google account is already linked to another account.')
        } else {
          setError(err.message)
        }
      } else {
        setError('Something went wrong. Please try again.')
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleCancel() {
    setIsCancelling(true)
    setError(null)

    try {
      await api.del('/auth/google/link')
      navigate('/login', { replace: true })
    } catch {
      setError('Could not cancel the request. Please try again.')
      setIsCancelling(false)
    }
  }

  return (
    <div>
      <h1 className="font-display text-[30px] font-bold leading-tight tracking-[-0.03em] text-ink">
        Link your Google account
      </h1>
      <p className="ah-lead mt-2">
        An account with this email already exists.
        Confirm your password to link Google to it.
      </p>

      <div className="mt-7 space-y-4">
        {error && (
          <div role="alert" className="ah-alert">
            {error}
          </div>
        )}

        {isExpired ? (
          <div className="space-y-4">
            <p className="text-body text-ink-muted">
              Please start Google sign-in again.
            </p>
            <a href="/api/auth/google" className="ah-btn-primary h-[46px] w-full rounded-[11px] lg:h-[46px]">
              Start again with Google
            </a>
            <Link to="/login" className="ah-link block text-center text-body">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={handleLink} className="space-y-4">
              <div>
                <label htmlFor="link-password" className="ah-label">
                  Your Knowly password
                </label>
                <input
                  id="link-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="ah-input"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isCancelling}
                className="ah-btn-primary h-[46px] w-full rounded-[11px] lg:h-[46px]"
              >
                {isSubmitting ? 'Linking…' : 'Link Google account'}
              </button>
            </form>

            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting || isCancelling}
              className="ah-btn-secondary h-[46px] w-full rounded-[11px] lg:h-[46px]"
            >
              {isCancelling ? 'Cancelling…' : 'Cancel'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
