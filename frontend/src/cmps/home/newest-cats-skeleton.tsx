import type React from 'react'
import { NEWEST_CATS_LIMIT } from '../../models/home'

// Uses the .cat-list grid, so the cards land in the same spots as the real ones
export const NewestCatsSkeleton: React.FC = () => {
  return (
    <ul
      className="newest-cats-skeleton cat-list clean-list"
      aria-busy="true"
      aria-label="Loading cats"
    >
      {Array.from({ length: NEWEST_CATS_LIMIT }, (_, idx) => (
        <li key={idx} className="card">
          <span className="skel img" />
          <span className="skel line" />
          <span className="skel line short" />
        </li>
      ))}
    </ul>
  )
}
