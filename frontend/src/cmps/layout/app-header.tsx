import type React from 'react'
import { Link, NavLink } from 'react-router'

export const AppHeader: React.FC = () => {
  return (
    <header className="app-header">
      <div className="main-layout content">
        <Link to="/cat" className="logo">
          <span className="paw" aria-hidden="true">
            🐾
          </span>
          cat-store
        </Link>
        {/* About joins in Part 2, Login in Part 3 */}
        <nav>
          <NavLink to="/cat">Cats</NavLink>
          <NavLink to="/dashboard">Dashboard</NavLink>
        </nav>
      </div>
    </header>
  )
}
