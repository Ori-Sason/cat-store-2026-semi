import type React from 'react'
import { Link, useLocation } from 'react-router'
import { reviewPermissionService, type ReviewWithRefs } from '@cat-store/shared'
import { utilService } from '../../../services/util.service'
import { useLoggedInUserStore } from '../../../store/logged-in-user.store'
import { CatImg } from '../cat/cat-img'
import { UserChips } from '../user/user-chips'
import { ReviewEditable } from './review-editable'

// The page the row is on. Each page already shows one side of the review, so the row's header
// shows the other: the author on a cat's page, the cat on a user's page.
// A shownOn flag, not a renderHeader prop per page: the chip rules (You / Owner / Admin) stay in
// this file
export type ReviewShownOn = 'cat' | 'user'

interface ReviewPreviewProps {
  review: ReviewWithRefs
  shownOn: ReviewShownOn
}

export const ReviewPreview: React.FC<ReviewPreviewProps> = ({ review, shownOn }) => {
  const location = useLocation()
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
          // "On" before the thumb, so it doesn't read as the author's avatar
          <span className="cat-ref">
            On{' '}
            <Link to={`/cat/${review.cat._id}`} state={utilService.buildBackToState(location)}>
              <CatImg cat={review.cat} alt="" isSoldOutShown={false} />
              <span className="cat-name">{review.cat.name}</span>
            </Link>
          </span>
        )}
        <UserChips isAdmin={isAdminShown} isOwner={isByCatOwner} isYou={isYouShown} />
        <time dateTime={new Date(review.createdAt).toISOString()}>
          {utilService.formatDate(review.createdAt)}
        </time>
      </header>

      {isCanEdit ? <ReviewEditable review={review} /> : <p className="content">{review.content}</p>}
    </article>
  )
}
