import type React from 'react'
import { useId, useRef } from 'react'

interface ReviewActionsMenuProps {
  isDisabled: boolean
  onEdit: () => void
  onDelete: () => void
}

// A ⋮ button that opens Edit / Delete. A popover="auto" in the top layer: the browser handles
// click-outside and Escape, and the card can't clip it. CSS anchors it to the button, and
// flips it up when there's no room below.
// A disclosure with plain buttons, not role="menu": that role promises arrow-key navigation
export const ReviewActionsMenu: React.FC<ReviewActionsMenuProps> = ({
  isDisabled,
  onEdit,
  onDelete,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const anchorName = `--review-actions${menuId}`

  // A choice closes the menu first. Focus then returns to the ⋮ button
  function onChoose(action: () => void) {
    popoverRef.current?.hidePopover()
    action()
  }

  return (
    <div className="review-actions-menu">
      <button
        type="button"
        className="menu-btn"
        aria-label="Review actions"
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
        <button type="button" onClick={() => onChoose(onEdit)}>
          Edit
        </button>
        <button type="button" className="danger" onClick={() => onChoose(onDelete)}>
          Delete
        </button>
      </div>
    </div>
  )
}
