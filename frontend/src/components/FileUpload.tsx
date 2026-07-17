// FileUpload — STUB. Renders nothing for now. Task D-10 implements picking files,
// POSTing them to /api/files, and calling onUploaded with the returned metadata.
import type { Attachment } from '../lib/types'

type Props = { onUploaded?: (attachment: Attachment) => void }

export default function FileUpload(_props: Props) {
  return null
}
