import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router'
import catImg from '../../assets/img/cat-default-color.png'
import { NAV_LINKS } from '../../models/nav-link'
import { authService } from '../../services/auth.service'
import { errorService } from '../../services/error.service'
import { useLoggedInUserStore } from '../../store/logged-in-user.store'
import { useUserMsgStore } from '../../store/user-msg.store'
import { HeaderMenu } from './header-menu'

export const AppHeader: React.FC = () => {
  const loggedInUser = useLoggedInUserStore((state) => state.loggedInUser)
  const { pathname, search } = useLocation()
  const navigate = useNavigate()
  const headerRef = useRef<HTMLElement>(null)
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [prevPathname, setPrevPathname] = useState(pathname)
  // Directed back to this page after logging in
  const loginTo = `/login?redirectTo=${encodeURIComponent(pathname + search)}`

  // A route change closes the menu (Alt+← or Mouse back button). Adjusted during render,
  // not in an effect, so the old page's menu never paints over the new page
  if (pathname !== prevPathname) {
    setPrevPathname(pathname)
    setIsMenuOpen(false)
  }

  // Crossing the media query breakpoint swaps the menu's trigger and layout.
  // Close it, so the focused trigger isn't hidden and the card doesn't jump between layouts
  useEffect(() => {
    const bpMd = getComputedStyle(headerRef.current!).getPropertyValue('--bp-md').trim()
    const mediaQuery = window.matchMedia(`(min-width: ${bpMd})`)
    const onChange = () => setIsMenuOpen(false)
    mediaQuery.addEventListener('change', onChange)
    return () => mediaQuery.removeEventListener('change', onChange)
  }, [])

  function toggleMenu() {
    setIsMenuOpen((prev) => !prev)
  }

  function closeMenu() {
    setIsMenuOpen(false)
  }

  async function onLogout() {
    closeMenu()
    try {
      await authService.logout()
      useLoggedInUserStore.getState().clearLoggedInUser()
      useUserMsgStore.getState().showSuccessMsg('Logged out')
      // The homepage, like most sites. Staying put would need this page to re-check auth
      void navigate('/')
    } catch (err) {
      useUserMsgStore.getState().showErrorMsg(errorService.getErrorMsg(err))
    }
  }

  return (
    <header className="app-header" ref={headerRef}>
      <div className="main-layout content">
        <Link to="/cat" className="logo">
          <img src={catImg} alt="" />
          cat-store
        </Link>
        <div className="end">
          {/* The nav, divider and Login link are desktop only */}
          <nav>
            {NAV_LINKS.map(({ to, label }) => (
              <NavLink key={to} to={to}>
                {label}
              </NavLink>
            ))}
          </nav>
          <span className="divider" aria-hidden="true" />
          {!loggedInUser && (
            <Link to={loginTo} className="login-btn">
              Login
            </Link>
          )}
          <HeaderMenu
            user={loggedInUser}
            isOpen={isMenuOpen}
            loginTo={loginTo}
            onToggle={toggleMenu}
            onClose={closeMenu}
            onLogout={onLogout}
          />
        </div>
      </div>
    </header>
  )
}
