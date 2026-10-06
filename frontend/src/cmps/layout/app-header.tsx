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
        {/* Login joins in Part 3 */}
        <nav>
          <NavLink to="/cat">Cats</NavLink>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/about">About</NavLink>
        </nav>
      </div>
    </header>
  )
}
