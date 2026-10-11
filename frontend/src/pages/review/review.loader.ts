import type { ReviewFilter } from '@cat-store/shared'
import type { LoaderFunctionArgs } from 'react-router'
import { reviewService } from '../../services/review.service'
import { utilService } from '../../services/util.service'

// The loader of a page's reviews section, which is its own child route: after a review action
// only this reloads, while the parent page keeps its data (utilService.skipReloadOnActionAt).
// One loader for every page that lists reviews: the route's :id is the cat or the user,
// and filterKey says which.
// Not async on purpose, like the home loader: the reviews go out un-awaited, and the section
// resolves them in its own <Await>, so a failed call breaks only that section.
// The parent's loader runs in parallel with this one, so the cat doesn't wait on the reviews
export function reviewLoader(
  { params }: Pick<LoaderFunctionArgs, 'params'>,
  filterKey: keyof ReviewFilter,
) {
  const filterBy: ReviewFilter = { [filterKey]: params.id! }
  return { reviews: utilService.withSilentReject(reviewService.query(filterBy)) }
}
