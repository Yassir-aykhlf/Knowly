
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
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            Knowly
          </p>

          <h1 className="mt-2 text-2xl font-semibold">
            Link your Google account
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            An account with this email already exists.
            Confirm your password to link Google to it.
          </p>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </div>
        )}

        {isExpired ? (
          <div className="space-y-4">
            <p className="text-sm text-slate-600">
              Please start Google sign-in again.
            </p>

            <a
              href="/api/auth/google"
              className="block w-full rounded-md bg-accent px-4 py-2 text-center text-sm font-semibold text-white"
            >
              Start again with Google
            </a>

            <Link
              to="/login"
              className="block text-center text-sm text-accent hover:underline"
            >
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <form onSubmit={handleLink} className="space-y-4">
              <div>
                <label
                  htmlFor="link-password"
                  className="mb-1 block text-sm font-medium"
                >
                  Your Knowly password
                </label>

                <input
                  id="link-password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isSubmitting || isCancelling}
                className="w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
              >
                {isSubmitting ? 'Linking…' : 'Link Google account'}
              </button>
            </form>

            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting || isCancelling}
              className="mt-4 w-full rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-60"
            >
              {isCancelling ? 'Cancelling…' : 'Cancel'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
