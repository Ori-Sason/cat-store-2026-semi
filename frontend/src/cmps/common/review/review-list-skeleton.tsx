import type React from 'react'

const _ROW_COUNT = 3

// Rows shaped like ReviewPreview: an author line, then two lines of text
export const ReviewListSkeleton: React.FC = () => {
  return (
    <ul className="review-list-skeleton clean-list" aria-busy="true" aria-label="Loading reviews">
      {Array.from({ length: _ROW_COUNT }, (_, idx) => (
        <li key={idx}>
          <span className="skel line author" />
          <span className="skel line" />
          <span className="skel line short" />
        </li>
      ))}
    </ul>
  )
}
