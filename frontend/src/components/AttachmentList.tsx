import type { Attachment } from '../lib/types'
import type { BeginFileOperation } from '../hooks/useAttachments'
import { api } from '../lib/api'

type Props = {
  items: Attachment[]
  onDelete?: (id: string) => void
  beginOperation?: BeginFileOperation
  disabled?: boolean
}

export default function AttachmentList({ items, onDelete, beginOperation, disabled = false }: Props) {
  async function remove(item: Attachment) {
    const finish = beginOperation?.()
    if (beginOperation && !finish) return
    try {
      await api.del(`/files/${item.id}`)
      onDelete?.(item.id)
    } finally {
      finish?.()
    }
  }

  if (items.length === 0) return null
  return (
    <ul className="space-y-1 text-body-sm">
      {items.map((item) => (
        <li key={item.id} className="flex items-center gap-2">
          <a href={item.url} target="_blank" rel="noreferrer" className="text-accent hover:underline">
            {item.original_filename}
          </a>
          {onDelete && (
            <button type="button" disabled={disabled} onClick={() => void remove(item)} className="text-ink-faint hover:text-red-600">
              Remove
            </button>
          )}
        </li>
      ))}
    </ul>
  )
}
