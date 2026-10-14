import termsContent from '../content/terms-of-service.md?raw'
import MarkdownDoc from '../components/MarkdownDoc'

export default function TermsOfServicePage() {
  return <MarkdownDoc content={termsContent} />
}