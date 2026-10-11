import type React from 'react'
import { reviewPermissionService, type ReviewWithRefs } from '@cat-store/shared'
import { utilService } from '../../../services/util.service'
import { useLoggedInUserStore } from '../../../store/logged-in-user.store'
import { ReviewEditable } from './review-editable'

interface ReviewPreviewProps {
  review: ReviewWithRefs
}

export const ReviewPreview: React.FC<ReviewPreviewProps> = ({ review }) => {
  const loggedInUser = useLoggedInUserStore((state) => state.loggedInUser)
  const isCanEdit = reviewPermissionService.canEditReview({ userId: review.user._id }, loggedInUser)
  const isOwnReview = review.user._id === loggedInUser?._id
  const isByCatOwner = review.user._id === review.cat.ownerId

  return (
    <article className="review-preview">
      <header>
        <span className="author">{review.user.fullname}</span>
        {isByCatOwner && <span className="chip owner">Owner</span>}
        {isOwnReview && <span className="chip">You</span>}
        <time dateTime={new Date(review.createdAt).toISOString()}>
          {utilService.formatDate(review.createdAt)}
        </time>
      </header>

      {isCanEdit ? <ReviewEditable review={review} /> : <p className="content">{review.content}</p>}
    </article>
  )
}
