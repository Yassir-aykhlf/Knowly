import { useRef, useState } from 'react'
import type { Attachment } from '../lib/types'
import type { BeginFileOperation } from '../hooks/useAttachments'
import { api } from '../lib/api'
import { useToast } from '../contexts/ToastContext'

type Props = {
  items: Attachment[]
  onDelete?: (id: string) => void
  beginOperation?: BeginFileOperation
  disabled?: boolean
}

function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function AttachmentList({ items, onDelete, beginOperation, disabled = false }: Props) {
  const { showToast } = useToast()
  const [hidden, setHidden] = useState(new Set<string>())
  const [brokenImages, setBrokenImages] = useState(new Set<string>())
  const [pending, setPending] = useState(0)
  const deleting = useRef(new Set<string>())

  async function remove(item: Attachment) {
    if (disabled || !onDelete || deleting.current.has(item.id)) return
    const finish = beginOperation?.()
    if (beginOperation && !finish) return
    deleting.current.add(item.id)
    setPending((count) => count + 1)
    setHidden((previous) => new Set(previous).add(item.id))
    try {
      await api.del(`/files/${item.id}`)
    } catch (error) {
      setHidden((previous) => {
        const next = new Set(previous)
        next.delete(item.id)
        return next
      })
      showToast(error instanceof Error ? error.message : 'Could not delete attachment. Please try again.', 'error')
      return
    } finally {
      deleting.current.delete(item.id)
      setPending((count) => count - 1)
      finish?.()
    }
    onDelete(item.id)
  }

  if (items.length === 0 && pending === 0) return null
  return (
    <div className="space-y-2 text-body-sm">
      <ul aria-label="Attachments" className="space-y-2">
        {items.filter((item) => !hidden.has(item.id)).map((item) => {
          const isImage = item.mime_type.startsWith('image/')
          const imageKey = `${item.id}:${item.url}`
          return (
            <li key={item.id} className="rounded-btn border border-line bg-surface px-3 py-3">
              {isImage && !brokenImages.has(imageKey) && (
                <a href={item.url} target="_blank" rel="noreferrer" aria-label={`Open image ${item.original_filename}`}>
                  <img src={item.url} alt={item.original_filename} loading="lazy"
                    className="mb-3 max-h-48 max-w-full rounded-btn object-contain"
                    onError={() => setBrokenImages((previous) => new Set(previous).add(imageKey))} />
                </a>
              )}
              {isImage && brokenImages.has(imageKey) && (
                <p className="mb-2 text-meta text-ink-muted">Image preview unavailable. Try the download link.</p>
              )}
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <a href={item.url} download={item.original_filename} className="break-all text-accent hover:underline">
                    {item.original_filename}
                  </a>
                  <span className="ml-2 whitespace-nowrap text-meta text-ink-faint">{fileSize(item.size_bytes)}</span>
                </div>
                {onDelete && (
                  <button type="button" disabled={disabled} aria-label={`Delete ${item.original_filename}`}
                    onClick={() => void remove(item)} className="shrink-0 text-ink-muted hover:text-red-600 disabled:opacity-50">
                    Remove
                  </button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
      {pending > 0 && <p role="status" className="text-ink-muted">Deleting attachment…</p>}
    </div>
  )
}
