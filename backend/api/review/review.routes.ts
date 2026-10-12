import { Router } from 'express'
import { reviewContentSchema, reviewFilterSchema, reviewSchema } from '@cat-store/shared'
import { requireAuth } from '../../middlewares/require-auth.middleware.ts'
import { requireReviewOwner } from '../../middlewares/require-review-owner.middleware.ts'
import { validateBody, validateQuery } from '../../middlewares/validate.middleware.ts'
import { addReview, getReviews, removeReview, updateReview } from './review.controller.ts'

export const reviewRoutes = Router()

// One flat collection, filtered by ?catId= / ?userId=. The filter is required (400 without one)
// Flat, not nested under cats/users, so one router serves both the cat page and the user's reviews tab.
// The required filter enforces "no system-wide reviews list" at the API, not only in the UI
reviewRoutes.get('/', validateQuery(reviewFilterSchema), getReviews)
reviewRoutes.post('/', requireAuth, validateBody(reviewSchema), addReview)
// requireReviewOwner (which includes requireAuth) runs before validateBody, so a non-author gets a 403, not a 400
reviewRoutes.put('/:id', requireReviewOwner, validateBody(reviewContentSchema), updateReview)
reviewRoutes.delete('/:id', requireReviewOwner, removeReview)
