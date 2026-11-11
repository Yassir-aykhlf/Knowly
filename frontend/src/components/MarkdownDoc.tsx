import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
export default function MarkdownDoc({ content }: { content: string }) {
  return (
    <article className="ah-page markdown-doc max-w-[840px]">
      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{content}</ReactMarkdown>
    </article>
  )
}
