import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
export default function MarkdownDoc({ content }: { content: string }) {
  return (
    <article className="markdown-doc max-w-3xl ml-[15px]">
      <ReactMarkdown rehypePlugins={[rehypeSanitize]}>{content}</ReactMarkdown>
    </article>
  )
}
