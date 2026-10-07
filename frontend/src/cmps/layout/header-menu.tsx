import type React from 'react'
import type { LoggedInUser } from '@cat-store/shared'
import { useId, useRef } from 'react'
import { Link, NavLink } from 'react-router'
import { useDismiss } from '../../hooks/use-dismiss'
import { NAV_LINKS } from '../../models/nav-link'
import { utilService } from '../../services/util.service'
import { UserAvatar } from './user-avatar'

interface HeaderMenuProps {
  user: LoggedInUser | null
  isOpen: boolean
  loginTo: string
  onToggle: () => void
  onClose: () => void
  onLogout: () => void
}

// One menu for every screen size. CSS swaps the button's content: the avatar from $bp-md up,
// a hamburger below. The page rows only show below $bp-md, where the bar's nav is hidden.
// Guests get it below $bp-md only. On desktop they have the bar's Login link
export const HeaderMenu: React.FC<HeaderMenuProps> = ({
  user,
  isOpen,
  loginTo,
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
    <div className={`header-menu ${user ? '' : 'guest'}`} ref={rootRef}>
      <button
        ref={menuBtnRef}
        type="button"
        className="menu-btn"
        aria-label="Menu"
        aria-expanded={isOpen}
        aria-controls={cardId}
        onClick={onToggle}
      >
        {user && <UserAvatar fullname={user.fullname} />}
        <span className="hamburger" aria-hidden="true" />
      </button>
      {isOpen && (
        <div id={cardId} className="menu-card">
          {user && (
            <div className="who">
              <UserAvatar fullname={user.fullname} size="lg" />
              <div className="who-txt">
                <strong>Hi, {utilService.getFirstName(user.fullname)}!</strong>
                <span className="names">
                  {user.fullname} · @{user.username}
                </span>
                {user.isAdmin && <span className="admin-chip">Admin</span>}
              </div>
            </div>
          )}
          <nav className="page-rows">
            {NAV_LINKS.map(({ to, label }) => (
              <NavLink key={to} to={to} onClick={onClose}>
                {label}
              </NavLink>
            ))}
          </nav>
          {user && <hr />}
          {user ? (
            <button type="button" className="action-btn" onClick={onLogout}>
              Logout
            </button>
          ) : (
            <Link to={loginTo} className="action-btn" onClick={onClose}>
              Login
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
