import type React from 'react'

const _ROW_COUNT = 3

interface ReviewListSkeletonProps {
  label?: string
}

// Rows shaped like ReviewPreview: an author line, then two lines of text. The chat log reuses
// them, since its rows have the same shape
export const ReviewListSkeleton: React.FC<ReviewListSkeletonProps> = ({
  label = 'Loading reviews',
}) => {
  return (
    <ul className="review-list-skeleton clean-list" aria-busy="true" aria-label={label}>
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
