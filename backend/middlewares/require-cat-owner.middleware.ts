import type { RequestHandler } from 'express'
import { catService } from '../api/cat/cat.service.ts'
import { HttpError } from '../models/http-error.ts'
import { alsService } from '../services/als.service.ts'
import { requireAuth } from './require-auth.middleware.ts'

// A missing cat is a 404 here, before the ownership check, so it never shows up as a 403
const _checkCatOwner: RequestHandler<{ id: string }> = async (req, _res, next) => {
  const verifiedUser = alsService.getVerifiedUser()
  const cat = await catService.getById(req.params.id)
  const isOwner = cat.ownerId.toHexString() === verifiedUser._id
  if (!isOwner && !verifiedUser.isAdmin) {
    throw new HttpError(403, 'FORBIDDEN', `Cat ${req.params.id} isn't yours`) // 403 Forbidden
  }
  next()
}

// Lets through the cat's owner, or any admin. Includes requireAuth, so mount it alone,
// on a route with `:id`. Express runs the array in order, as if each handler were listed
export const requireCatOwner = [requireAuth, _checkCatOwner]
