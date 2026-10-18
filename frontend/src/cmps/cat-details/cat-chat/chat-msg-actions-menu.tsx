import type React from 'react'
import { useId, useRef } from 'react'

interface ChatMsgActionsMenuProps {
  isEditable: boolean // the author only. An admin on someone else's msg gets Delete alone
  isDisabled: boolean // while the msg waits on an edit or remove ack
  onEdit: () => void
  onRemove: () => void
}

// The review row's ⋮ menu, for a chat msg: a popover="auto" in the top layer, so the browser
// handles click-outside and Escape, and the scrolling log can't clip it. CSS anchors it to the
// button and flips it up near the bottom of the panel.
// A disclosure with plain buttons, not role="menu": that role promises arrow-key navigation
export const ChatMsgActionsMenu: React.FC<ChatMsgActionsMenuProps> = ({
  isEditable,
  isDisabled,
  onEdit,
  onRemove,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const menuId = useId()
  const anchorName = `--chat-msg-actions${menuId}`

  // A choice closes the menu first, with the focus back on the ⋮ button: the delete confirm
  // reads it as its opener, to give the focus back to when it closes. Set by hand, not left to
  // the popover's own focus return, so it's in place before the action runs
  function onChoose(action: () => void) {
    popoverRef.current?.hidePopover()
    menuBtnRef.current?.focus()
    action()
  }

  return (
    <div className="chat-msg-actions-menu">
      <button
        ref={menuBtnRef}
        type="button"
        className="menu-btn"
        aria-label="Message actions"
        popoverTarget={menuId}
        disabled={isDisabled}
        style={{ anchorName }}
      >
        <span aria-hidden="true">⋮</span>
      </button>
      <div
        id={menuId}
        className="menu"
        popover="auto"
        ref={popoverRef}
        style={{ positionAnchor: anchorName }}
      >
        {isEditable && (
          <button type="button" onClick={() => onChoose(onEdit)}>
            Edit
          </button>
        )}
        <button type="button" className="danger" onClick={() => onChoose(onRemove)}>
          Delete
        </button>
      </div>
    </div>
  )
}
