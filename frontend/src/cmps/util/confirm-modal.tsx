import type React from 'react'
import { useEffect, useId, useRef } from 'react'

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  msg: string
  confirmTxt: string
  onConfirm: () => void
  onClose: () => void
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  msg,
  confirmTxt,
  onConfirm,
  onClose,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current!
    if (isOpen && !dialog.open) dialog.showModal()
    if (!isOpen && dialog.open) dialog.close()
  }, [isOpen])

  // The dialog box itself has no padding, so a click that lands on the dialog is on the backdrop
  function onDialogClick(ev: React.MouseEvent<HTMLDialogElement>) {
    if (ev.target === ev.currentTarget) onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className="confirm-modal"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={onDialogClick}
    >
      <div className="content">
        <h2 id={titleId}>{title}</h2>
        <p>{msg}</p>
        <div className="actions">
          <button type="button" className="sub-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="main-btn danger-btn" onClick={onConfirm}>
            {confirmTxt}
          </button>
        </div>
      </div>
    </dialog>
  )
}
