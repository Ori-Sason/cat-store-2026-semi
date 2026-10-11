import type { RequestHandler } from 'express'
import { reviewPermissionService } from '@cat-store/shared'
import { reviewService } from '../api/review/review.service.ts'
import { HttpError } from '../models/http-error.ts'
import { alsService } from '../services/als.service.ts'
import { requireAuth } from './require-auth.middleware.ts'

// A missing review is a 404 here, before the ownership check, so it never shows up as a 403
const _checkReviewOwner: RequestHandler<{ id: string }> = async (req, _res, next) => {
  const verifiedUser = alsService.getVerifiedUser()
  const review = await reviewService.getById(req.params.id)
  const userId = review.userId.toHexString()
  if (!reviewPermissionService.canEditReview({ userId }, verifiedUser)) {
    throw new HttpError(403, 'FORBIDDEN', `Review ${req.params.id} isn't yours`) // 403 Forbidden
  }
  next()
}

// Lets through the review's author, or any admin. Includes requireAuth, so mount it alone,
// on a route with `:id`. Express runs the array in order, as if each handler were listed
export const requireReviewOwner = [requireAuth, _checkReviewOwner]
