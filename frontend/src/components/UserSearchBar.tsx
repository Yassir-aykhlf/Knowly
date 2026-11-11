import { useEffect, useRef, useState } from 'react'

import NavIcon from './NavIcon'

type Props = {
  value: string
  onSearch: (value: string) => void
  delay?: number
  placeholder?: string
  label?: string
}

// Debounced search field: typing searches after `delay`, Enter searches now.
export default function UserSearchBar({
  value,
  onSearch,
  delay = 300,
  placeholder = 'Search people…',
  label = 'Search people',
}: Props) {
  const [text, setText] = useState(value)
  const onSearchRef = useRef(onSearch)
  onSearchRef.current = onSearch

  useEffect(() => {
    setText(value)
  }, [value])

  useEffect(() => {
    if (text.trim() === value.trim()) return
    const t = setTimeout(() => onSearchRef.current(text.trim()), delay)
    return () => clearTimeout(t)
  }, [text, value, delay])

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault()
        onSearch(text.trim())
      }}
      className="relative w-full"
    >
      <NavIcon name="search" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-dim" />
      <input
        type="search"
        value={text}
        maxLength={50}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className="ah-input rounded-xl pl-10"
      />
    </form>
  )
}
