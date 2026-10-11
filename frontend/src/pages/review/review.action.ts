import type { ReviewInput } from '@cat-store/shared'
import { data, type ActionFunctionArgs } from 'react-router'
import { reviewService } from '../../services/review.service'
import { utilService } from '../../services/util.service'
import { useUserMsgStore } from '../../store/user-msg.store'

// An action-only route: fetchers post here from any page that shows reviews. After a success,
// react-router reloads the loaders of the page the fetcher is on, not this route's, so each
// page refreshes its own reviews. One method per REST call: POST /review → POST /api/reviews.
// It never throws: a throw would swap the page for the route error element
export async function reviewAction({ request }: Pick<ActionFunctionArgs, 'request'>) {
  try {
    switch (request.method) {
      case 'POST': {
        const review = await reviewService.add((await request.json()) as ReviewInput)
        useUserMsgStore.getState().showSuccessMsg('Review added')
        // The new id tells the add form a fresh success came back, so it can clear itself
        return { review }
      }
      default:
        return data(null, { status: 405 }) // 405 Method Not Allowed
    }
  } catch (err) {
    return utilService.toActionError(err)
  }
}
