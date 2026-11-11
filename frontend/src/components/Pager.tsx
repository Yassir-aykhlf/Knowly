type Props = {
  page: number
  totalPages: number
  onChange: (page: number) => void
  label?: string
}

// Pagination footer pinned to the bottom of the scrolling <main>. The page
// wrapper should be `flex flex-1 flex-col` so `mt-auto` keeps it at the bottom
// of short pages too.
export default function Pager({ page, totalPages, onChange, label = 'Pagination' }: Props) {
  if (totalPages <= 1) return null

  function go(next: number) {
    onChange(next)
    document.getElementById('app-main')?.scrollTo({ top: 0 })
  }

  return (
    <nav aria-label={label} className="ah-pager">
      <button type="button" disabled={page <= 1} onClick={() => go(page - 1)} className="ah-btn-secondary ah-btn-sm">
        Previous
      </button>
      <span className="whitespace-nowrap px-1 text-body-sm font-medium text-ink-muted" aria-live="polite">
        Page {page} of {totalPages}
      </span>
      <button type="button" disabled={page >= totalPages} onClick={() => go(page + 1)} className="ah-btn-secondary ah-btn-sm">
        Next
      </button>
    </nav>
  )
}
