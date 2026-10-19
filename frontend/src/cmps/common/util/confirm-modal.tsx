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

// A modal <dialog> that asks before a destructive action. role="alertdialog" over the native
// dialog role: screen readers announce it as an interruption and read the msg with the title.
// showModal() focuses the first button, Cancel: on a destructive choice, the safe one is the default
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
  const msgId = useId()

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
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={msgId}
      onClose={onClose}
      onClick={onDialogClick}
    >
      <div className="content">
        <h2 id={titleId}>{title}</h2>
        <p id={msgId}>{msg}</p>
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
