import type React from 'react'
import { useEffect, useId, useRef } from 'react'

interface ChatMsgRemoveConfirmProps {
  msgText: string // quoted, so the user sees which msg they're deleting
  onConfirm: () => void
  onCancel: () => void
}

// "Delete this message?" inside the panel, in the confirm modal's look. Not the app's
// ConfirmModal: a modal <dialog> dims the whole page, and this dims only the log and the composer
// (the caller makes them inert while it's open). The chat header stays live, so × still closes.
// Cancel takes the focus: on a destructive choice, the safe button is the default
export const ChatMsgRemoveConfirm: React.FC<ChatMsgRemoveConfirmProps> = ({
  msgText,
  onConfirm,
  onCancel,
}) => {
  const cancelBtnRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const quoteId = useId()
  const descId = useId()

  useEffect(() => {
    cancelBtnRef.current?.focus()
  }, [])

  // Escape stops here: the panel closes on an Escape that reaches it
  function onKeyDown(ev: React.KeyboardEvent) {
    if (ev.key !== 'Escape') return
    ev.stopPropagation()
    onCancel()
  }

  // A click on the dimmed area around the box cancels, like the modal's backdrop
  function onOverlayClick(ev: React.MouseEvent) {
    if (ev.target === ev.currentTarget) onCancel()
  }

  return (
    <div className="chat-msg-remove-confirm" onClick={onOverlayClick} onKeyDown={onKeyDown}>
      <div
        className="box"
        role="alertdialog"
        aria-labelledby={titleId}
        aria-describedby={`${quoteId} ${descId}`}
      >
        <h3 id={titleId}>Delete this message?</h3>
        {/* Quoted so a tap on the wrong row's ⋮ is caught here. Clamped in the SCSS */}
        <blockquote id={quoteId} className="quote">
          <p>{msgText}</p>
        </blockquote>
        <p id={descId} className="desc">
          Everyone will see "Message deleted" in its place. This can't be undone.
        </p>
        <div className="confirm-btns">
          <button ref={cancelBtnRef} type="button" className="sub-btn" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="main-btn danger-btn" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}
