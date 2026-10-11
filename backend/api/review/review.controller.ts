import type { Request, Response } from 'express'
import type { ReviewFilter, ReviewInput } from '@cat-store/shared'
import { alsService } from '../../services/als.service.ts'
import { reviewService } from './review.service.ts'

// req.query is already parsed by validateQuery(reviewFilterSchema)
export async function getReviews(
  req: Request<object, unknown, unknown, ReviewFilter>,
  res: Response,
) {
  const reviews = await reviewService.query(req.query)
  res.json(reviews)
}

// req.body is already parsed by validateBody(reviewSchema)
export async function addReview(req: Request<object, unknown, ReviewInput>, res: Response) {
  const verifiedUserId = alsService.getVerifiedUser()._id
  const review = await reviewService.add(req.body, verifiedUserId)
  res.status(201).json(review) // 201 Created
}
