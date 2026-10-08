import type { RequestHandler } from 'express'
import { authService } from '../api/auth/auth.service.ts'
import { HttpError } from '../models/http-error.ts'
import { alsService } from '../services/als.service.ts'

// Lets only logged-in users through. attachTokenUser trusts the token alone, so this re-reads
// the user from the DB: a deleted user gets a 401, and a changed isAdmin applies right away.
// The fresh user goes in the ALS store as verifiedUser, the only user permission checks and
// controllers read (via alsService.getVerifiedUser()). Mount after attachTokenUser.
// Idempotent: bundled require* middlewares include it, so a route can end up running it twice
export const requireAuth: RequestHandler = async (_req, _res, next) => {
  const store = alsService.getStore()
  if (store.verifiedUser) return next()

  const verifiedUser =
    store.tokenUser && (await authService.getLoggedInUserById(store.tokenUser._id))
  if (!verifiedUser) throw new HttpError(401, 'UNAUTHORIZED', 'Log in to do this') // 401 Unauthorized
  store.verifiedUser = verifiedUser
  next()
}
