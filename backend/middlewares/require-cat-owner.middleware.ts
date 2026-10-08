import type { RequestHandler } from 'express'
import { catService } from '../api/cat/cat.service.ts'
import { HttpError } from '../models/http-error.ts'
import { alsService } from '../services/als.service.ts'

// Lets through the cat's owner, or any admin. Mount after requireAuth, on a route with `:id`.
// A missing cat is a 404 here, before the ownership check, so it never shows up as a 403
export const requireCatOwner: RequestHandler<{ id: string }> = async (req, _res, next) => {
  const loggedInUser = alsService.getStore().loggedInUser
  if (!loggedInUser)
    throw new Error('requireCatOwner runs without a logged-in user - mount requireAuth first')

  const cat = await catService.getById(req.params.id)
  const isOwner = cat.ownerId.toHexString() === loggedInUser._id
  if (!isOwner && !loggedInUser.isAdmin) {
    throw new HttpError(403, 'FORBIDDEN', `Cat ${req.params.id} isn't yours`) // 403 Forbidden
  }
  next()
}
