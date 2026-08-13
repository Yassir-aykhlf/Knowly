import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

import { ApiError } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import { USERNAME_RE, validatePassword } from '../lib/validation'

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
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">
            Knowly
          </p>
          <h1 className="mt-2 text-2xl font-semibold">Create your account</h1>
          <p className="mt-2 text-sm text-slate-500">
            Join Knowly and start learning with the community.
          </p>
        </div>

        {formError && (
          <div
            role="alert"
            className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {formError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="register-email"
              className="mb-1 block text-sm font-medium"
            >
              Email
            </label>

            <input
              id="register-email"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
            />

            {fieldErrors.email && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.email}</p>
            )}
          </div>

          <div>
            <label
              htmlFor="register-username"
              className="mb-1 block text-sm font-medium"
            >
              Username
            </label>

            <input
              id="register-username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
            />

            <p className="mt-1 text-xs text-slate-500">
              3–30 characters: letters, numbers, _ or -
            </p>

            {fieldErrors.username && (
              <p className="mt-1 text-sm text-red-600">
                {fieldErrors.username}
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor="register-password"
              className="mb-1 block text-sm font-medium"
            >
              Password
            </label>

            <input
              id="register-password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              required
            />

            <p className="mt-1 text-xs text-slate-500">
              8–128 characters, with at least one letter and one digit
            </p>

            {fieldErrors.password && (
              <p className="mt-1 text-sm text-red-600">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have an account?{' '}
          <Link to="/login" className="font-medium text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}