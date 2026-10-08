import type { RequestHandler } from 'express'
import { authService } from '../api/auth/auth.service.ts'
import { LOGIN_TOKEN_COOKIE, LOGIN_TOKEN_COOKIE_OPTIONS } from '../models/auth.ts'
import { HttpError } from '../models/http-error.ts'
import { alsService } from '../services/als.service.ts'

// Lets only logged-in users through. attachTokenUser trusts the token alone, so this re-reads
// the user from the DB: a deleted user gets a 401, and a changed isAdmin applies right away.
// The fresh user goes in the ALS store as verifiedUser, the only user permission checks and
// controllers read (via alsService.getVerifiedUser()). Mount after attachTokenUser.
// Idempotent: bundled require* middlewares include it, so a route can end up running it twice
export const requireAuth: RequestHandler = async (_req, res, next) => {
  const store = alsService.getStore()
  if (store.verifiedUser) return next()

  const verifiedUser =
    store.tokenUser && (await authService.getLoggedInUserById(store.tokenUser._id))
  if (!verifiedUser) {
    // A valid token for a user that's gone - drop the cookie, like /api/auth/me does
    if (store.tokenUser) res.clearCookie(LOGIN_TOKEN_COOKIE, LOGIN_TOKEN_COOKIE_OPTIONS)
    throw new HttpError(401, 'UNAUTHORIZED', 'Log in to do this') // 401 Unauthorized
  }
  store.verifiedUser = verifiedUser
  next()
}
