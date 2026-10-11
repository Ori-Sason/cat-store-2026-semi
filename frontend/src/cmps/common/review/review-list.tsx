import type React from 'react'
import type { ReviewWithRefs } from '@cat-store/shared'
import { ReviewPreview } from './review-preview'

interface ReviewListProps {
  reviews: ReviewWithRefs[]
}

export const ReviewList: React.FC<ReviewListProps> = ({ reviews }) => {
  if (!reviews.length) return <p className="review-list empty">No reviews yet</p>

  return (
    <ul className="review-list clean-list">
      {reviews.map((review) => (
        <li key={review._id}>
          <ReviewPreview review={review} />
        </li>
      ))}
    </ul>
  )
}
