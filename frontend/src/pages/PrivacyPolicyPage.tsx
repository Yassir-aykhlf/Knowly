import privacyContent from '../content/privacy-policy.md?raw'
import MarkdownDoc from '../components/MarkdownDoc'

export default function PrivacyPolicyPage() {
  return <MarkdownDoc content={privacyContent} />
}