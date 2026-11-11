import { useEffect, useId, useRef, type ReactNode } from 'react'

import NavIcon from './NavIcon'

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
      className="ah-dialog"
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
        <h2 id={titleId} className="ah-h3">{title}</h2>
        <button type="button" aria-label="Close dialog" onClick={onClose} className="ah-icon-btn -mr-2">
          <NavIcon name="close" size={18} />
        </button>
      </div>
      {children}
    </dialog>
  )
}
