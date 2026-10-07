import type { RequestHandler } from 'express'
import { authService } from '../api/auth/auth.service.ts'
import { LOGIN_TOKEN_COOKIE } from '../models/auth.ts'
import { alsService } from '../services/als.service.ts'

// Reads the loginToken cookie into the ALS store. Never blocks: no cookie, or a bad or expired
// token, just means a guest. Token-only (no DB), so it's for logs and /me's lookup, not for
// permission checks - those belong to requireAuth / requireAdmin.
// Mount after cookieParser and setupAsyncLocalStorage
export const attachLoggedInUser: RequestHandler = (req, _res, next) => {
  const loginToken: unknown = req.cookies?.[LOGIN_TOKEN_COOKIE]
  if (typeof loginToken === 'string') {
    alsService.getStore().loggedInUser = authService.verifyLoginToken(loginToken)
  }
  next()
}
