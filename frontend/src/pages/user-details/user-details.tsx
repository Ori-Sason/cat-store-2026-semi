import type React from 'react'
import { NavLink, Outlet, useLoaderData } from 'react-router'
import { utilService } from '../../services/util.service'
import type { userDetailsLoader } from './user-details.loader'

export const UserDetails: React.FC = () => {
  const { user } = useLoaderData<typeof userDetailsLoader>()

  return (
    <section className="user-details">
      <header className="profile-head">
        <h1>{user.fullname}</h1>
        <p className="joined">Joined {utilService.formatDate(user.createdAt)}</p>
      </header>

      {/* `end` keeps Cats inactive on the other tabs: "." is a prefix of every tab's URL */}
      <nav className="tabs" aria-label="User sections">
        <NavLink to="." end>
          Cats
        </NavLink>
      </nav>

      {/* The tab: a child route with its own loader */}
      <Outlet />
    </section>
  )
}
