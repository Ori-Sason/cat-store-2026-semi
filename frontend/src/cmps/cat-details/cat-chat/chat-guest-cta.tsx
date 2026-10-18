import type React from 'react'
import { Link, useLocation } from 'react-router'

// In the composer's place for a guest: the log stays readable, and the login comes back here
export const ChatGuestCta: React.FC = () => {
  const location = useLocation()

  return (
    <div className="chat-guest-cta">
      <p>You're reading as a guest.</p>
      <Link
        to={`/login?redirectTo=${encodeURIComponent(location.pathname + location.search)}`}
        className="main-btn"
      >
        Log in to chat
      </Link>
    </div>
  )
}
