import { useCallback, useRef, useState } from 'react'
import type { Attachment } from '../lib/types'

export type BeginFileOperation = () => (() => void) | null

export function useAttachments(initial: Attachment[] = []) {
  const [items, setItems] = useState(initial)
  const current = useRef(initial)
  const active = useRef(0)
  const locked = useRef(false)
  const [pending, setPending] = useState(0)
  const [submitting, setSubmitting] = useState(false)

  const replace = useCallback((next: Attachment[]) => {
    current.current = next
    setItems(next)
  }, [])

  const add = useCallback((item: Attachment) => {
    replace([...current.current.filter((attachment) => attachment.id !== item.id), item])
  }, [replace])

  const remove = useCallback((id: string) => {
    replace(current.current.filter((attachment) => attachment.id !== id))
  }, [replace])

  const beginOperation: BeginFileOperation = useCallback(() => {
    if (locked.current) return null
    active.current += 1
    setPending(active.current)
    let finished = false
    return () => {
      if (finished) return
      finished = true
      active.current -= 1
      setPending(active.current)
    }
  }, [])

  async function submit<T>(send: (attachmentIds: string[]) => Promise<T>): Promise<T> {
    if (active.current > 0) throw new Error('Wait for file operations to finish.')
    if (locked.current) throw new Error('A submission is already in progress.')
    locked.current = true
    setSubmitting(true)
    try {
      return await send(current.current.map((attachment) => attachment.id))
    } finally {
      locked.current = false
      setSubmitting(false)
    }
  }

  return {
    items, replace, add, remove, beginOperation, submit, pending, submitting,
    blocked: pending > 0 || submitting,
  }
}
