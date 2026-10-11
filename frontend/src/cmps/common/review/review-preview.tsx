import type React from 'react'
import type { ReviewWithRefs } from '@cat-store/shared'
import { utilService } from '../../../services/util.service'

interface ReviewPreviewProps {
  review: ReviewWithRefs
}

export const ReviewPreview: React.FC<ReviewPreviewProps> = ({ review }) => {
  return (
    <article className="review-preview">
      <header>
        <span className="author">{review.user.fullname}</span>
        <time dateTime={new Date(review.createdAt).toISOString()}>
          {utilService.formatDate(review.createdAt)}
        </time>
      </header>
      <p className="content">{review.content}</p>
    </article>
  )
}
