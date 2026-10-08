import type { RequestHandler } from 'express'
import { authService } from '../api/auth/auth.service.ts'
import { LOGIN_TOKEN_COOKIE, LOGIN_TOKEN_COOKIE_OPTIONS } from '../models/auth.ts'
import { alsService } from '../services/als.service.ts'

// Reads the loginToken cookie into the ALS store as the token user. Never blocks: no cookie, or a
// bad or expired token, just means a guest. Token-only (no DB), so it's for logs and /me's lookup,
// not for permission checks - those read the verified user that requireAuth sets.
// Mount after cookieParser and setupAsyncLocalStorage
export const attachTokenUser: RequestHandler = (req, res, next) => {
  const loginToken: unknown = req.cookies?.[LOGIN_TOKEN_COOKIE]
  if (loginToken === undefined) return next()

  const tokenUser = typeof loginToken === 'string' ? authService.verifyLoginToken(loginToken) : null
  alsService.getStore().tokenUser = tokenUser
  // A cookie that can never verify again (expired, tampered, garbage) - drop it, so the
  // browser stops sending it and later requests are plain guests
  if (!tokenUser) res.clearCookie(LOGIN_TOKEN_COOKIE, LOGIN_TOKEN_COOKIE_OPTIONS)
  next()
}
