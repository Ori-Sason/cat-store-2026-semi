import type { RequestHandler } from 'express'
import { authService } from '../api/auth/auth.service.ts'
import { LOGIN_TOKEN_COOKIE, LOGIN_TOKEN_COOKIE_OPTIONS } from '../models/auth.ts'
import { alsService } from '../services/als.service.ts'

// Reads the loginToken cookie into the ALS store. Never blocks: no cookie, or a bad or expired
// token, just means a guest. Token-only (no DB), so it's for logs and /me's lookup, not for
// permission checks - those belong to requireAuth / requireAdmin.
// Mount after cookieParser and setupAsyncLocalStorage
export const attachLoggedInUser: RequestHandler = (req, res, next) => {
  const loginToken: unknown = req.cookies?.[LOGIN_TOKEN_COOKIE]
  if (loginToken === undefined) return next()

  const loggedInUser =
    typeof loginToken === 'string' ? authService.verifyLoginToken(loginToken) : null
  alsService.getStore().loggedInUser = loggedInUser
  // A cookie that can never verify again (expired, tampered, garbage) - drop it, so the
  // browser stops sending it and later requests are plain guests
  if (!loggedInUser) res.clearCookie(LOGIN_TOKEN_COOKIE, LOGIN_TOKEN_COOKIE_OPTIONS)
  next()
}
