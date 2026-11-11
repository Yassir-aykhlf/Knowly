import type { ReactNode } from 'react'

type EmptyProps = {
  title: string
  children?: ReactNode
  action?: ReactNode
}

export function EmptyState({ title, children, action }: EmptyProps) {
  return (
    <div className="ah-empty">
      <p className="ah-empty-title">{title}</p>
      {children && <p className="ah-empty-text">{children}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

type ErrorProps = {
  title?: string
  message: string
  onRetry?: () => void
}

export function ErrorState({ title = 'Something went wrong', message, onRetry }: ErrorProps) {
  return (
    <div role="alert" className="ah-empty">
      <p className="ah-empty-title">{title}</p>
      <p className="mt-1.5 text-body text-danger">{message}</p>
      {onRetry && (
        <div className="mt-4 flex justify-center">
          <button type="button" onClick={onRetry} className="ah-btn-secondary ah-btn-sm">
            Retry
          </button>
        </div>
      )}
    </div>
  )
}

// Placeholder cards shown while a list loads.
export function SkeletonCards({ count = 4, className = '' }: { count?: number; className?: string }) {
  return (
    <div role="status" aria-label="Loading" className={className}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="ah-card flex flex-col gap-3 p-[18px]">
          <div className="ah-skeleton h-4 w-1/3" />
          <div className="ah-skeleton h-5 w-11/12" />
          <div className="ah-skeleton h-5 w-2/3" />
          <div className="ah-skeleton mt-2 h-4 w-1/2" />
        </div>
      ))}
    </div>
  )
}

export function SkeletonRows({ count = 4 }: { count?: number }) {
  return (
    <div role="status" aria-label="Loading" className="flex flex-col gap-2 p-3">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex items-center gap-3 p-2">
          <div className="ah-skeleton h-10 w-10 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <div className="ah-skeleton h-3.5 w-1/2" />
            <div className="ah-skeleton h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  )
}
