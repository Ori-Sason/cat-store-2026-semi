import type { CookieOptions } from 'express'

// The cookie that holds the signed JWT. Same name as the token itself (see glossary)
export const LOGIN_TOKEN_COOKIE = 'loginToken'

// Set and clear with these. The browser identifies a cookie by name + domain + path, so
// changing `path` (or adding a `domain`) makes clearCookie miss cookies set before the change
export const LOGIN_TOKEN_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production', // Secure is for HTTPS. Dev runs on http://localhost
  path: '/',
}
