import { useRef, useState } from 'react'
import type { Attachment } from '../lib/types'
import type { BeginFileOperation } from '../hooks/useAttachments'
import { api, ApiError } from '../lib/api'
import AttachmentList from './AttachmentList'
import NavIcon from './NavIcon'

type Props = {
  onUploaded?: (attachment: Attachment) => void
  onRemoved?: (id: string) => void
  beginOperation?: BeginFileOperation
  disabled?: boolean
  attachmentCount?: number
}

type Upload = {
  id: number
  name: string
  status: 'uploading' | 'done' | 'error'
  attachment?: Attachment
  error?: string
}

const MAX_ATTACHMENTS = 10

export default function FileUpload({
  onUploaded, onRemoved, beginOperation, disabled = false, attachmentCount,
}: Props) {
  const [uploads, setUploads] = useState<Upload[]>([])
  const [dragging, setDragging] = useState(false)
  const [limitError, setLimitError] = useState('')
  const nextId = useRef(0)
  const pending = useRef(0)
  const completed = useRef(new Set<string>())
  const currentCount = useRef(attachmentCount)
  currentCount.current = attachmentCount

  function count() {
    return (currentCount.current ?? completed.current.size) + pending.current
  }

  function update(id: number, patch: Partial<Upload>) {
    setUploads((previous) => previous.map((upload) => upload.id === id ? { ...upload, ...patch } : upload))
  }

  async function upload(file: File) {
    const finish = beginOperation?.()
    if (beginOperation && !finish) return
    const id = nextId.current++
    pending.current += 1
    setUploads((previous) => [...previous, { id, name: file.name, status: 'uploading' }])
    const form = new FormData()
    form.append('file', file)
    try {
      const attachment = await api.postForm<Attachment>('/files', form)
      completed.current.add(attachment.id)
      update(id, { status: 'done', attachment })
      onUploaded?.(attachment)
    } catch (error) {
      update(id, {
        status: 'error',
        error: error instanceof ApiError
          ? error.fields?.file || error.message
          : 'Upload failed. Please try again.',
      })
    } finally {
      pending.current -= 1
      finish?.()
    }
  }

  function select(files: File[]) {
    if (disabled) return
    setLimitError('')
    for (const file of files) {
      if (count() >= MAX_ATTACHMENTS) {
        setLimitError('At most 10 attachments are allowed per post. Remove a file to add another.')
        break
      }
      void upload(file)
    }
  }

  // Lane B renders its own AttachmentList. Standalone usage keeps the same
  // removal controls here, without displaying successful uploads twice in forms.
  const standaloneItems = uploads.flatMap((upload) => upload.attachment ? [upload.attachment] : [])
  const atLimit = count() >= MAX_ATTACHMENTS

  return (
    <div className="space-y-3 text-body-sm">
      <label
        className={`flex flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors focus-within:border-accent ${
          dragging ? 'border-accent bg-accent-wash' : 'border-line3 bg-surface-raised'
        } ${disabled || atLimit ? 'opacity-60' : 'cursor-pointer hover:border-accent-line hover:bg-accent-wash'}`}
        onDragOver={(event) => {
          event.preventDefault()
          if (!disabled && !atLimit) setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault()
          setDragging(false)
          select(Array.from(event.dataTransfer.files))
        }}
      >
        <NavIcon name="upload" className="mb-1 text-ink-faint" />
        <span>
          <span className="font-semibold text-accent-dark">Choose files</span>
          <span className="text-ink-muted"> or drag them here</span>
        </span>
        <span className="block text-meta text-ink-faint">
          {count()} / {MAX_ATTACHMENTS} attachments · Files upload immediately
        </span>
        <input
          type="file"
          multiple
          aria-label="Attach files"
          className="sr-only"
          disabled={disabled || atLimit}
          onChange={(event) => {
            const files = Array.from(event.target.files ?? [])
            event.target.value = ''
            select(files)
          }}
        />
      </label>
      {limitError && <p role="alert" className="text-danger">{limitError}</p>}
      <ul className="space-y-2 empty:hidden" aria-label="File upload progress">
        {uploads.filter((upload) => upload.status !== 'done').map((upload) => (
          <li key={upload.id} className="rounded-xl border border-line bg-surface px-3 py-2">
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0 break-all text-ink">{upload.name}</span>
              {upload.status === 'error' && (
                <button type="button" className="text-ink-muted hover:text-ink"
                  aria-label={`Dismiss error for ${upload.name}`}
                  onClick={() => setUploads((previous) => previous.filter((item) => item.id !== upload.id))}>
                  Dismiss
                </button>
              )}
            </div>
            {upload.status === 'uploading' ? (
              <div className="mt-2 space-y-1">
                <progress aria-label={`Uploading ${upload.name}`} className="block h-2 w-full accent-accent" />
                <span className="text-meta text-ink-muted">Uploading…</span>
              </div>
            ) : <p role="alert" className="mt-1 text-danger">{upload.error}</p>}
          </li>
        ))}
      </ul>
      {attachmentCount === undefined && (
        <AttachmentList
          items={standaloneItems}
          beginOperation={beginOperation}
          disabled={disabled}
          onDelete={(id) => {
            completed.current.delete(id)
            setUploads((previous) => previous.filter((upload) => upload.attachment?.id !== id))
            setLimitError('')
            onRemoved?.(id)
          }}
        />
      )}
    </div>
  )
}
