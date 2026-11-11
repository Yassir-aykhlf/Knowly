import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'

type Props = { markdown: string; compact?: boolean }

const EXTERNAL_LINK = /^https?:\/\//i

const components: Components = {
  a: ({ node: _node, href, ...props }) => {
    const external = href !== undefined && EXTERNAL_LINK.test(href)
    return (
      <a
        {...props}
        href={href}
        {...(external && { target: '_blank', rel: 'noopener noreferrer nofollow' })}
      />
    )
  },

  img: ({ node: _node, ...props }) => (
    <img {...props} loading="lazy" />
  ),
}

export default function MarkdownBody({ markdown, compact = false }: Props) {
  return (
    <div className={`markdown-doc ${compact ? 'markdown-doc-compact' : ''}`}>
      <ReactMarkdown rehypePlugins={[rehypeSanitize]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  )
}