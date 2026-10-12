import type React from 'react'
import { Suspense, useState } from 'react'
import { Await, Link, useFetcher, useLoaderData, useLocation, useParams } from 'react-router'
import type { ReviewContentInput } from '@cat-store/shared'
import type { reviewAction } from '../../pages/review/review.action'
import type { reviewLoader } from '../../pages/review/review.loader'
import { useLoggedInUserStore } from '../../store/logged-in-user.store'
import { ReviewEdit } from '../common/review/review-edit'
import { ReviewList } from '../common/review/review-list'
import { ReviewListSkeleton } from '../common/review/review-list-skeleton'
import { SectionError } from '../common/util/section-error'

// The reviews child route of /cat/:id, rendered through cat-details' <Outlet>. Its own route,
// so a review action reloads only the reviews (reviewLoader), not the cat.

// The heading and the add form render right away. Only the list waits on the API.
// This owns the add fetcher, not ReviewList: the form sits outside <Await>, and the user
// page reuses ReviewList with no form
export const CatReviews: React.FC = () => {
  const { reviews } = useLoaderData<typeof reviewLoader>()
  const catId = useParams().id!
  const loggedInUser = useLoggedInUserStore((state) => state.loggedInUser)
  const location = useLocation()
  const fetcher = useFetcher<typeof reviewAction>()
  const isSaving = fetcher.state !== 'idle'

  // A new key remounts ReviewEdit, which clears the text and its touched / submitted state.
  // The key follows the id of the last added review, so it changes only on a new success.
  // A failed add returns no review, so the key (and the typed text) stays.
  // Set during render, not in an effect: React's pattern for state derived from a change
  const [formKey, setFormKey] = useState('new')
  const addedReviewId = fetcher.data?.review._id
  if (addedReviewId && addedReviewId !== formKey) setFormKey(addedReviewId)

  function onAddReview({ content }: ReviewContentInput) {
    void fetcher.submit(
      { catId, content },
      { method: 'post', action: '/review', encType: 'application/json' },
    )
  }

  return (
    <section className="cat-reviews" aria-labelledby="cat-reviews-title">
      <h2 id="cat-reviews-title">Reviews</h2>

      {loggedInUser ? (
        <ReviewEdit key={formKey} isSaving={isSaving} onSave={onAddReview} />
      ) : (
        <p className="login-prompt">
          <Link to={`/login?redirectTo=${encodeURIComponent(location.pathname + location.search)}`}>
            Log in
          </Link>{' '}
          to write a review
        </p>
      )}

      <Suspense fallback={<ReviewListSkeleton />}>
        <Await resolve={reviews} errorElement={<SectionError />}>
          {(reviews) => <ReviewList reviews={reviews} shownOn="cat" />}
        </Await>
      </Suspense>
    </section>
  )
}
