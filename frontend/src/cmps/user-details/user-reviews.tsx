import type React from 'react'
import { Suspense } from 'react'
import { Await, useLoaderData, useParams } from 'react-router'
import type { reviewLoader } from '../../pages/review/review.loader'
import { ReviewList } from '../common/review/review-list'
import { ReviewListSkeleton } from '../common/review/review-list-skeleton'
import { SectionError } from '../common/util/section-error'

// The reviews tab of /user/:id, rendered through user-details' <Outlet>. A thin wrapper over
// ReviewList: no add form here (that lives on the cat's page). Each editable row owns its
// fetcher, and after an edit / delete react-router reloads only this tab's reviewLoader.
// The key remounts the <Suspense> per user, like the cats tab
export const UserReviews: React.FC = () => {
  const { reviews } = useLoaderData<typeof reviewLoader>()
  const userId = useParams().id!

  return (
    <section className="user-reviews">
      <Suspense key={userId} fallback={<ReviewListSkeleton />}>
        <Await resolve={reviews} errorElement={<SectionError />}>
          {(reviews) => <ReviewList reviews={reviews} shownOn="user" />}
        </Await>
      </Suspense>
    </section>
  )
}
