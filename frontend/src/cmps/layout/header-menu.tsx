import type React from 'react'
import type { LoggedInUser } from '@cat-store/shared'
import { useId, useRef } from 'react'
import { useDismiss } from '../../hooks/use-dismiss'
import { utilService } from '../../services/util.service'
import { UserAvatar } from './user-avatar'

interface HeaderMenuProps {
  user: LoggedInUser
  isOpen: boolean
  onToggle: () => void
  onClose: () => void
  onLogout: () => void
}

export const HeaderMenu: React.FC<HeaderMenuProps> = ({
  user,
  isOpen,
  onToggle,
  onClose,
  onLogout,
}) => {
  const rootRef = useRef<HTMLDivElement>(null)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const cardId = useId()

  useDismiss(rootRef, isOpen, (ev) => {
    onClose()
    // Escape returns focus to the menu button. A click outside moves focus on its own
    if (ev.type === 'keydown') menuBtnRef.current?.focus()
  })

  return (
    <div className="header-menu" ref={rootRef}>
      <button
        ref={menuBtnRef}
        type="button"
        className="avatar-btn"
        aria-label="Menu"
        aria-expanded={isOpen}
        aria-controls={cardId}
        onClick={onToggle}
      >
        <UserAvatar fullname={user.fullname} />
      </button>
      {isOpen && (
        <div id={cardId} className="account-card">
          <div className="who">
            <UserAvatar fullname={user.fullname} size="lg" />
            <strong>Hi, {utilService.getFirstName(user.fullname)}!</strong>
            <span className="names">
              {user.fullname} · @{user.username}
            </span>
            {user.isAdmin && <span className="admin-chip">Admin</span>}
          </div>
          <hr />
          <button type="button" className="logout-btn" onClick={onLogout}>
            Logout
          </button>
        </div>
      )}
    </div>
  )
}
