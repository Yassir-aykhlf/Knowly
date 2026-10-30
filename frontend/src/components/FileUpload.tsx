import type { Attachment } from '../lib/types'
import type { BeginFileOperation } from '../hooks/useAttachments'
import { api } from '../lib/api'

type Props = {
  onUploaded?: (attachment: Attachment) => void
  onRemoved?: (id: string) => void
  beginOperation?: BeginFileOperation
  disabled?: boolean
}

export default function FileUpload({ onUploaded, beginOperation, disabled = false }: Props) {
  async function upload(file: File) {
    const finish = beginOperation?.()
    if (beginOperation && !finish) return
    const form = new FormData()
    form.append('file', file)
    try {
      const attachment = await api.postForm<Attachment>('/files', form)
      onUploaded?.(attachment)
    } finally {
      finish?.()
    }
  }

  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-body-sm text-accent">
      <span className="ah-btn-secondary">Attach file</span>
      <input
        type="file"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => {
          const file = event.target.files?.[0]
          event.target.value = ''
          if (file) void upload(file)
        }}
      />
    </label>
  )
}
