import type { ReviewContentInput, ReviewInput } from '@cat-store/shared'
import { data, type ActionFunctionArgs } from 'react-router'
import { reviewService } from '../../services/review.service'
import { utilService } from '../../services/util.service'
import { useUserMsgStore } from '../../store/user-msg.store'

// An action-only route: fetchers post here from any page that shows reviews. After a success,
// react-router reloads the loaders of the page the fetcher is on, not this route's, so each
// page refreshes its own reviews. One method per REST call:
// POST /review → POST /api/reviews, PUT / DELETE /review/:id → PUT / DELETE /api/reviews/:id.
// It never throws: a throw would swap the page for the route error element
export async function reviewAction({
  request,
  params,
}: Pick<ActionFunctionArgs, 'request' | 'params'>) {
  // Set on /review/:id, the route the PUT / DELETE fetchers post to
  const reviewId = params.id
  try {
    switch (request.method) {
      case 'POST': {
        const review = await reviewService.add((await request.json()) as ReviewInput)
        useUserMsgStore.getState().showSuccessMsg('Review added')
        // The new id tells the add form a fresh success came back, so it can clear itself
        return { review }
      }
      case 'PUT': {
        const input = (await request.json()) as ReviewContentInput
        const review = await reviewService.update(reviewId!, input)
        useUserMsgStore.getState().showSuccessMsg('Review updated')
        // A fresh result tells the review's edit form to close
        return { review }
      }
      case 'DELETE': {
        await reviewService.remove(reviewId!)
        useUserMsgStore.getState().showSuccessMsg('Review deleted')
        return null
      }
      default:
        return data(null, { status: 405 }) // 405 Method Not Allowed
    }
  } catch (err) {
    return utilService.toActionError(err)
  }
}
