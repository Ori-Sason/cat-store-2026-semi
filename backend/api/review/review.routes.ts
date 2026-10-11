import { Router } from 'express'
import { reviewFilterSchema, reviewSchema } from '@cat-store/shared'
import { requireAuth } from '../../middlewares/require-auth.middleware.ts'
import { validateBody, validateQuery } from '../../middlewares/validate.middleware.ts'
import { addReview, getReviews } from './review.controller.ts'

export const reviewRoutes = Router()

// One flat collection, filtered by ?catId= / ?userId=. The filter is required (400 without one)
reviewRoutes.get('/', validateQuery(reviewFilterSchema), getReviews)
reviewRoutes.post('/', requireAuth, validateBody(reviewSchema), addReview)
