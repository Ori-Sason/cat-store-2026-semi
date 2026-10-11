import { Router } from 'express'
import { reviewFilterSchema } from '@cat-store/shared'
import { validateQuery } from '../../middlewares/validate.middleware.ts'
import { getReviews } from './review.controller.ts'

export const reviewRoutes = Router()

// One flat collection, filtered by ?catId= / ?userId=. The filter is required (400 without one)
reviewRoutes.get('/', validateQuery(reviewFilterSchema), getReviews)
