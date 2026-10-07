import type React from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router'
import catImg from '../../assets/img/cat-default-color.png'
import { NAV_LINKS } from '../../models/nav-link'
import { authService } from '../../services/auth.service'
import { errorService } from '../../services/error.service'
import { useLoggedInUserStore } from '../../store/logged-in-user.store'
import { useUserMsgStore } from '../../store/user-msg.store'

export const AppHeader: React.FC = () => {
  const loggedInUser = useLoggedInUserStore((state) => state.loggedInUser)
  const { pathname, search } = useLocation()
  const navigate = useNavigate()

  async function onLogout() {
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
    <header className="app-header">
      <div className="main-layout content">
        <Link to="/cat" className="logo">
          <img src={catImg} alt="" />
          cat-store
        </Link>
        <div className="end">
          <nav>
            {NAV_LINKS.map(({ to, label }) => (
              <NavLink key={to} to={to}>
                {label}
              </NavLink>
            ))}
          </nav>
          <span className="divider" aria-hidden="true" />
          <div className="user-area">
            {loggedInUser ? (
              <>
                {/* First word only - keeps the header short */}
                <span className="greeting">Hi, {loggedInUser.fullname.split(' ')[0]}</span>
                <button type="button" className="logout-btn" onClick={onLogout}>
                  Logout
                </button>
              </>
            ) : (
              // Come back to this page after logging in
              <Link
                to={`/login?redirectTo=${encodeURIComponent(pathname + search)}`}
                className="login-btn"
              >
                Login
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
