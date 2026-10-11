import type { Review } from '../models/review.ts'
import type { LoggedInUserOrGuest } from '../models/user.ts'

// The review rules (roadmap Part 5). The FE uses them to decide which Add / Edit / Delete
// options to show. The BE enforces edit / delete through canEditReview (requireReviewOwner),
// and add with requireAuth, which checks the same thing.
// The FE answers from the logged-in user it hydrated, which can be stale, so only the BE's
// answer (with a verified user) is a real guard

// Any logged-in user, including the cat's owner: reviewing your own cat is allowed
function canAddReview(loggedInUser: LoggedInUserOrGuest): boolean {
  return !!loggedInUser
}

// Edit and delete: the review's author, or any admin
function canEditReview(review: Pick<Review, 'userId'>, loggedInUser: LoggedInUserOrGuest): boolean {
  if (!loggedInUser) return false
  return loggedInUser.isAdmin || review.userId === loggedInUser._id
}

export const reviewPermissionService = {
  canAddReview,
  canEditReview,
}
