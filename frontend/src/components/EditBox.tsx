import { useState, type FormEvent } from 'react'

import { ApiError } from '../lib/api'

type Props = {
  initial?: string
  validate: (value: string) => string | null
  max: number
  rows?: number
  placeholder?: string
  submitLabel: string
  onSubmit: (value: string) => Promise<void>
  onCancel?: () => void
  resetOnSuccess?: boolean
  autoFocus?: boolean
}

export default function EditBox({
  initial = '',
  validate,
  max,
  rows = 4,
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
  resetOnSuccess = false,
  autoFocus = false,
}: Props) {
  const [value, setValue] = useState(initial)
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState<string | null>(null)

  const error = validate(value)
  const length = value.trim().length
  const shownError = serverError ?? (touched ? error : null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (error || busy) return

    setBusy(true)
    setServerError(null)
    try {
      await onSubmit(value)
      if (resetOnSuccess) {
        setValue('')
        setTouched(false)
      }
    } catch (err) {
      setServerError(
        err instanceof ApiError ? (err.fields?.body ?? err.message) : 'Something went wrong',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        value={value}
        rows={rows}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={(e) => {
          setValue(e.target.value)
          setServerError(null)
        }}
        onBlur={() => setTouched(true)}
        aria-invalid={shownError !== null}
        className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-accent focus:outline-none"
      />
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="text-red-600">{shownError}</span>
        <span className={`tabular-nums ${length > max ? 'text-red-600' : 'text-slate-400'}`}>
          {length.toLocaleString()} / {max.toLocaleString()}
        </span>
      </div>
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-accent px-3 py-1.5 text-sm text-white hover:bg-accent-dark disabled:opacity-50"
        >
          {busy ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border px-3 py-1.5 text-sm"
          >
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
