import ReactMarkdown, { type Components } from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'

type Props = { markdown: string }

const EXTERNAL_LINK = /^https?:\/\//i

const components: Components = {
  h1: ({ node: _node, ...props }) => <h1 {...props} className="text-2xl font-semibold" />,
  h2: ({ node: _node, ...props }) => <h2 {...props} className="text-xl font-semibold" />,
  h3: ({ node: _node, ...props }) => <h3 {...props} className="text-lg font-semibold" />,
  h4: ({ node: _node, ...props }) => <h4 {...props} className="font-semibold" />,
  h5: ({ node: _node, ...props }) => <h5 {...props} className="font-semibold" />,
  h6: ({ node: _node, ...props }) => <h6 {...props} className="font-semibold" />,
  ul: ({ node: _node, ...props }) => <ul {...props} className="list-disc space-y-1 pl-6" />,
  ol: ({ node: _node, ...props }) => <ol {...props} className="list-decimal space-y-1 pl-6" />,
  blockquote: ({ node: _node, ...props }) => (
    <blockquote {...props} className="border-l-4 border-slate-300 pl-4 italic text-slate-600" />
  ),
  hr: ({ node: _node, ...props }) => <hr {...props} className="border-slate-200" />,

  code: ({ node: _node, className, ...props }) => (
    <code
      {...props}
      className={`rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.9em] ${className ?? ''}`}
    />
  ),
  pre: ({ node: _node, ...props }) => (
    <pre
      {...props}
      className="overflow-x-auto rounded-md bg-slate-900 p-4 text-sm leading-relaxed text-slate-100 [&>code]:bg-transparent [&>code]:p-0 [&>code]:text-inherit"
    />
  ),

  a: ({ node: _node, href, ...props }) => {
    const external = href !== undefined && EXTERNAL_LINK.test(href)
    return (
      <a
        {...props}
        href={href}
        className="text-accent underline hover:text-accent-dark"
        {...(external && { target: '_blank', rel: 'noopener noreferrer nofollow' })}
      />
    )
  },

  img: ({ node: _node, ...props }) => (
    <img {...props} loading="lazy" className="h-auto max-w-full rounded" />
  ),
}

export default function MarkdownBody({ markdown }: Props) {
  return (
    <div className="space-y-3 break-words leading-relaxed">
      <ReactMarkdown rehypePlugins={[rehypeSanitize]} components={components}>
        {markdown}
      </ReactMarkdown>
    </div>
  )
}