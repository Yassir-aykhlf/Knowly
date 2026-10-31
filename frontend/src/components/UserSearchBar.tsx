import { useEffect, useRef, useState } from 'react'

type Props = {
  value: string
  onSearch: (value: string) => void
  delay?: number
}

export default function UserSearchBar({ value, onSearch, delay = 300 }: Props) {
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
      className="flex w-full items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-2 shadow-sm focus-within:border-teal-600"
    >
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Search users..."
        aria-label="Search users"
        className="w-full bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
      />
      {text && (
        <button
          type="button"
          onClick={() => {
            setText('')
            onSearch('')
          }}
          aria-label="Clear search"
          className="text-sm text-gray-400 hover:text-gray-600"
        >
          ✕
        </button>
      )}
      <button type="submit" className="ah-btn-primary">
        Search
      </button>
    </form>
  )
}