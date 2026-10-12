import type React from 'react'
import { Link } from 'react-router'
import { reviewPermissionService, type ReviewWithRefs } from '@cat-store/shared'
import { utilService } from '../../../services/util.service'
import { useLoggedInUserStore } from '../../../store/logged-in-user.store'
import { CatImg } from '../cat/cat-img'
import { ReviewEditable } from './review-editable'

// The page the row is on. Each page already shows one side of the review, so the row's header
// shows the other: the author on a cat's page, the cat on a user's page
export type ReviewShownOn = 'cat' | 'user'

interface ReviewPreviewProps {
  review: ReviewWithRefs
  shownOn?: ReviewShownOn
}

export const ReviewPreview: React.FC<ReviewPreviewProps> = ({ review, shownOn = 'cat' }) => {
  const loggedInUser = useLoggedInUserStore((state) => state.loggedInUser)
  const isCanEdit = reviewPermissionService.canEditReview(review.user._id, loggedInUser)
  const isByCatOwner = review.user._id === review.cat.ownerId
  // On a user's page every row has the same author, so You would repeat on every row of
  // the viewer's own profile
  const isYouShown = shownOn === 'cat' && review.user._id === loggedInUser?._id
  // Same on a user's page: the header there already marks an admin
  const isAdminShown = shownOn === 'cat' && review.user.isAdmin

  return (
    <article className={`review-preview shown-on-${shownOn}`}>
      <header>
        {shownOn === 'cat' ? (
          <span className="author">{review.user.fullname}</span>
        ) : (
          <span className="cat-ref">
            On{' '}
            <Link to={`/cat/${review.cat._id}`}>
              <CatImg cat={review.cat} alt="" isSoldOutShown={false} />
              <span className="cat-name">{review.cat.name}</span>
            </Link>
          </span>
        )}
        {isAdminShown && <span className="chip admin">Admin</span>}
        {isByCatOwner && <span className="chip owner">Owner</span>}
        {isYouShown && <span className="chip">You</span>}
        <time dateTime={new Date(review.createdAt).toISOString()}>
          {utilService.formatDate(review.createdAt)}
        </time>
      </header>

      {isCanEdit ? <ReviewEditable review={review} /> : <p className="content">{review.content}</p>}
    </article>
  )
}
