import { useEffect, useId, useRef, type ReactNode } from 'react'

type Props = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

export default function Modal({ open, onClose, title, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!open || !dialog) return
    const previous = document.activeElement
    dialog.showModal()
    return () => {
      dialog.close()
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className="w-full max-w-md rounded-lg bg-white p-5 shadow-lg backdrop:bg-black/40"
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return
        const rect = event.currentTarget.getBoundingClientRect()
        if (
          event.clientX < rect.left ||
          event.clientX > rect.right ||
          event.clientY < rect.top ||
          event.clientY > rect.bottom
        ) onClose()
      }}
    >
      <div className="mb-3 flex items-center justify-between gap-4">
        <h2 id={titleId} className="text-lg font-semibold">{title}</h2>
        <button type="button" aria-label="Close dialog" onClick={onClose}>×</button>
      </div>
      {children}
    </dialog>
  )
}
