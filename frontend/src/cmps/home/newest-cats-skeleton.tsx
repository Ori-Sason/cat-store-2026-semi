import type React from 'react'

const _CARD_COUNT = 4 // matches the home loader's limit

// Uses the .cat-list grid, so the cards land in the same spots as the real ones
export const NewestCatsSkeleton: React.FC = () => {
  return (
    <ul
      className="newest-cats-skeleton cat-list clean-list"
      aria-busy="true"
      aria-label="Loading cats"
    >
      {Array.from({ length: _CARD_COUNT }, (_, idx) => (
        <li key={idx} className="card">
          <span className="skel img" />
          <span className="skel line" />
          <span className="skel line short" />
        </li>
      ))}
    </ul>
  )
}
