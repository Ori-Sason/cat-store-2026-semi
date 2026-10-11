import type { Request, Response } from 'express'
import type { ReviewFilter } from '@cat-store/shared'
import { reviewService } from './review.service.ts'

// req.query is already parsed by validateQuery(reviewFilterSchema)
export async function getReviews(
  req: Request<object, unknown, unknown, ReviewFilter>,
  res: Response,
) {
  const reviews = await reviewService.query(req.query)
  res.json(reviews)
}
