import { useEffect, useRef, useState } from 'react'

import { api, ApiError } from '../lib/api'
import type { VoteResult } from '../lib/types'
import { useToast } from '../contexts/ToastContext'

type Props = {
  targetType: 'question' | 'answer'
  targetId: string
  total: number
  myVote: number
  disabled?: boolean
  disabledReason?: string
}

export default function VoteArrows({
  targetType,
  targetId,
  total,
  myVote,
  disabled = false,
  disabledReason,
}: Props) {
  const { showToast } = useToast()
  const [current, setCurrent] = useState<VoteResult>({ vote_total: total, my_vote: myVote })
  const inFlight = useRef(false)

  useEffect(() => {
    setCurrent({ vote_total: total, my_vote: myVote })
  }, [total, myVote])

  async function vote(direction: 1 | -1) {
    if (disabled || inFlight.current) return
    inFlight.current = true

    const previous = current
    const value = previous.my_vote === direction ? 0 : direction
    setCurrent({
      vote_total: previous.vote_total - previous.my_vote + value,
      my_vote: value,
    })

    try {
      const result = await api.post<VoteResult>(`/${targetType}s/${targetId}/vote`, { value })
      setCurrent({ vote_total: result.vote_total, my_vote: result.my_vote })
    } catch (err) {
      setCurrent(previous)
      const message = err instanceof ApiError ? err.message : 'Something went wrong'
      showToast(message, 'error')
    } finally {
      inFlight.current = false
    }
  }

  function arrowClass(active: boolean) {
    const base = 'flex h-8 w-8 items-center justify-center rounded-md text-lg transition-colors'
    if (disabled) return `${base} cursor-not-allowed text-slate-300`
    if (active) return `${base} text-accent hover:bg-slate-100`
    return `${base} text-slate-400 hover:bg-slate-100 hover:text-slate-700`
  }

  return (
    <div
      className="flex flex-col items-center gap-1"
      title={disabled ? disabledReason : undefined}
    >
      <button
        type="button"
        aria-label="Upvote"
        aria-pressed={current.my_vote === 1}
        disabled={disabled}
        onClick={() => void vote(1)}
        className={arrowClass(current.my_vote === 1)}
      >
        ▲
      </button>
      <span className="text-sm font-semibold tabular-nums text-slate-700">
        {current.vote_total}
      </span>
      <button
        type="button"
        aria-label="Downvote"
        aria-pressed={current.my_vote === -1}
        disabled={disabled}
        onClick={() => void vote(-1)}
        className={arrowClass(current.my_vote === -1)}
      >
        ▼
      </button>
    </div>
  )
}
