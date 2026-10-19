import type React from 'react'
import { useId, useRef } from 'react'

interface ActionsMenuProps {
  label: string // the ⋮ button's aria-label, e.g. "Review actions"
  isDisabled: boolean // while the item waits on its own save or delete
  onEdit?: () => void // left out → no Edit option (e.g. an admin on someone else's chat msg)
  onDelete: () => void
  menuBtnRef?: React.RefObject<HTMLButtonElement | null> // for a caller that gives the ⋮ the focus back
}

// A ⋮ button that opens Edit / Delete, for a review row and a chat msg. A popover="auto" in the
// top layer: the browser handles click-outside and Escape, and a card or a scrolling log can't
// clip it. CSS anchors it to the button, and flips it up when there's no room below.
// A disclosure with plain buttons, not role="menu": that role promises arrow-key navigation
export const ActionsMenu: React.FC<ActionsMenuProps> = ({
  label,
  isDisabled,
  onEdit,
  onDelete,
  menuBtnRef: menuBtnRefProp,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null)
  const ownMenuBtnRef = useRef<HTMLButtonElement>(null)
  const menuBtnRef = menuBtnRefProp ?? ownMenuBtnRef
  const isMenuOpenRef = useRef(false)
  const menuId = useId()
  const anchorName = `--actions-menu${menuId}`

  // A choice closes the menu first, with the focus back on the ⋮ button: a delete confirm reads
  // it as its opener, to give the focus back to when it closes. Set by hand, not left to the
  // popover's own focus return, so it's in place before the action runs. Edit then unmounts the
  // menu, and the edit form takes the focus
  function onChoose(action: () => void) {
    popoverRef.current?.hidePopover()
    menuBtnRef.current?.focus()
    action()
  }

  // The browser closes the popover on Escape, but the key still bubbles up. Stop it while the
  // menu is open, so a container that closes on Escape (the chat panel) stays open. keydown runs
  // before the popover closes, so the ref still says open here
  function onKeyDown(ev: React.KeyboardEvent) {
    if (ev.key === 'Escape' && isMenuOpenRef.current) ev.stopPropagation()
  }

  return (
    <div className="actions-menu" onKeyDown={onKeyDown}>
      <button
        ref={menuBtnRef}
        type="button"
        className="menu-btn"
        aria-label={label}
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
        onToggle={(ev) => (isMenuOpenRef.current = ev.newState === 'open')}
      >
        {onEdit && (
          <button type="button" onClick={() => onChoose(onEdit)}>
            Edit
          </button>
        )}
        <button type="button" className="danger" onClick={() => onChoose(onDelete)}>
          Delete
        </button>
      </div>
    </div>
  )
}
