import { useState, type FormEvent, type ReactNode } from 'react'

import { ApiError } from '../lib/api'

type Props = {
  disabled?: boolean
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
  label?: string
  // Rendered between the text area and the buttons (e.g. attachments).
  children?: ReactNode
  // Extra buttons rendered after submit / cancel.
  extraActions?: ReactNode
}

export default function EditBox({
  disabled = false,
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
  label,
  children,
  extraActions,
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
    if (error || busy || disabled) return

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
        err instanceof ApiError
          ? (err.fields?.body ?? err.message)
          : err instanceof Error
            ? err.message
            : 'Something went wrong',
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2.5">
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
        aria-label={label ?? placeholder ?? submitLabel}
        className="ah-textarea-mono rounded-card"
      />
      <div className="flex items-start justify-between gap-3 text-meta">
        <span className="text-danger" role={shownError ? 'alert' : undefined}>{shownError}</span>
        <span className={`shrink-0 tabular-nums ${length > max ? 'text-danger' : 'text-ink-faint'}`}>
          {length.toLocaleString()} / {max.toLocaleString()}
        </span>
      </div>
      {children}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={busy || disabled}
          className="ah-btn-primary"
        >
          {busy ? 'Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy || disabled}
            className="ah-btn-ghost"
          >
            Cancel
          </button>
        )}
        {extraActions}
      </div>
    </form>
  )
}
