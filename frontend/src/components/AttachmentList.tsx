// AttachmentList — STUB. Renders nothing for now. Task D-10 renders a post's
// attachments (inline images / download links) with optional delete.
import type { Attachment } from '../lib/types'

type Props = { items: Attachment[]; onDelete?: (id: string) => void }

export default function AttachmentList(_props: Props) {
  return null
}
