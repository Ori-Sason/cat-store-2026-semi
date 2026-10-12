import type React from 'react'

interface CatListSkeletonProps {
  count: number
}

// Uses the .cat-list grid, so the cards land in the same spots as the real ones
export const CatListSkeleton: React.FC<CatListSkeletonProps> = ({ count }) => {
  return (
    <ul
      className="cat-list-skeleton cat-list clean-list"
      aria-busy="true"
      aria-label="Loading cats"
    >
      {Array.from({ length: count }, (_, idx) => (
        <li key={idx} className="card">
          <span className="skel img" />
          <span className="skel line" />
          <span className="skel line short" />
        </li>
      ))}
    </ul>
  )
}
