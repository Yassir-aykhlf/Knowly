import { useEffect, useState } from 'react'

import { api } from '../lib/api'
import type { Paginated, SearchResult } from '../lib/types'

const MIN_LENGTH = 3

// Debounced full-text lookup of existing questions matching `text`.
// `items` is null until the first lookup for the current text finishes.
export function useSimilarQuestions(text: string, limit = 3, delay = 300) {
  const query = text.trim().replace(/\s+/g, ' ').slice(0, 200)
  const enabled = query.length >= MIN_LENGTH
  const [result, setResult] = useState<{ query: string; items: SearchResult[] } | null>(null)

  useEffect(() => {
    if (!enabled) return
    let ignore = false
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ q: query, limit: String(limit) })
      api
        .get<Paginated<SearchResult>>(`/search?${params.toString()}`)
        .then((data) => {
          if (!ignore) setResult({ query, items: data.items })
        })
        .catch(() => {
          // Suggestions are best-effort; a failed lookup just shows none.
          if (!ignore) setResult({ query, items: [] })
        })
    }, delay)
    return () => {
      ignore = true
      window.clearTimeout(timer)
    }
  }, [enabled, query, limit, delay])

  const current = enabled && result?.query === query
  return {
    enabled,
    loading: enabled && !current,
    items: current ? result.items : null,
  }
}
