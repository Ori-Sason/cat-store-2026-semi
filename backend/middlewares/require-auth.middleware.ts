import type { RequestHandler } from 'express'
import { authService } from '../api/auth/auth.service.ts'
import { HttpError } from '../models/http-error.ts'
import { alsService } from '../services/als.service.ts'

// Lets only logged-in users through. attachLoggedInUser trusts the token alone, so this re-reads
// the user from the DB: a deleted user gets a 401, and a changed isAdmin applies right away.
// The fresh user replaces the token user in the ALS store, so later middlewares and controllers
// read the up-to-date one. Mount after attachLoggedInUser
export const requireAuth: RequestHandler = async (_req, _res, next) => {
  const store = alsService.getStore()
  const loggedInUser =
    store.loggedInUser && (await authService.getLoggedInUserById(store.loggedInUser._id))
  if (!loggedInUser) throw new HttpError(401, 'UNAUTHORIZED', 'Log in to do this') // 401 Unauthorized
  store.loggedInUser = loggedInUser
  next()
}
