import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import type { LoggedInUser, LoginInput, UserInput } from '@cat-store/shared'
import { config } from '../../config/index.ts'
import { HttpError } from '../../models/http-error.ts'
import type { UserDoc } from '../../models/user.ts'
import { userService } from '../user/user.service.ts'

const _JWT_ALGORITHM = 'HS256'

// bcrypt cost: each +1 doubles the hash time.
// As of 2026-10-06: 10 is OWASP's minimum, enough for a side
// project. 12 is today's common default (PHP 8.4, Laravel, bcrypt-ruby)
export const BCRYPT_SALT_ROUNDS = 10

// Remember me → the cookie and the token both last this long
export const REMEMBERED_LOGIN_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
// No remember me → a session cookie, which the browser drops on close. The token still
// expires, so a browser that never closes doesn't keep the login forever
export const SESSION_LOGIN_TTL_MS = 24 * 60 * 60 * 1000 // 1 day

// A real hash of a random password, compared against when the username doesn't exist.
// Without it, an unknown username answers in ~1ms and a known one in ~50ms (bcrypt), and that
// gap tells an attacker which usernames exist. Same cost factor as real hashes, so same timing
const _DUMMY_PASSWORD_HASH = '$2b$10$pJ9kOOKbKj2/loFrKAXNwuDlFojao8Dbq.Ng8CtM6kofe5uyN2uiG'

async function signup({ fullname, username, password }: UserInput): Promise<LoggedInUser> {
  const user = await userService.add({
    fullname,
    username,
    password: await bcrypt.hash(password, BCRYPT_SALT_ROUNDS),
    isAdmin: false,
  })
  return _toLoggedInUser(user)
}

async function login({ username, password }: LoginInput): Promise<LoggedInUser> {
  const user = await userService.getByUsername(username)
  const isMatch = await bcrypt.compare(password, user?.password ?? _DUMMY_PASSWORD_HASH)
  // One error for both cases, so the response doesn't say which part was wrong
  if (!user || !isMatch) {
    throw new HttpError(401, 'INVALID_CREDENTIALS', 'Wrong username or password')
  }
  return _toLoggedInUser(user)
}

// Reads the user fresh from the DB, so a deleted user or a changed isAdmin shows up
// before the token expires
async function getLoggedInUserById(userId: string): Promise<LoggedInUser | null> {
  const user = await userService.getById(userId)
  /* FIX - consider if we will want the userService return loggedInUser (after we add usear routes) */
  return user && _toLoggedInUser(user)
}

function getLoginTokenTtlMs(isRemembered: boolean): number {
  return isRemembered ? REMEMBERED_LOGIN_TTL_MS : SESSION_LOGIN_TTL_MS
}

function createLoginToken(loggedInUser: LoggedInUser, isRemembered: boolean): string {
  return jwt.sign(loggedInUser, config.jwtSecret, {
    algorithm: _JWT_ALGORITHM,
    expiresIn: getLoginTokenTtlMs(isRemembered) / 1000, // jsonwebtoken takes seconds
  })
}

function verifyLoginToken(loginToken: string): LoggedInUser | null {
  try {
    // Pinning the algorithm blocks tokens signed with another one (e.g. "none")
    const payload = jwt.verify(loginToken, config.jwtSecret, { algorithms: [_JWT_ALGORITHM] })
    if (typeof payload === 'string') return null // type guard: createLoginToken only signs objects (not strings)
    const { _id, username, fullname, isAdmin } = payload
    return { _id, username, fullname, isAdmin } // drops iat and exp
  } catch {
    return null
  }
}

// IMPORTANT: removing the password (and dates)
function _toLoggedInUser({ _id, username, fullname, isAdmin }: UserDoc): LoggedInUser {
  return { _id: _id.toHexString(), username, fullname, isAdmin }
}

export const authService = {
  signup,
  login,
  getLoggedInUserById,
  getLoginTokenTtlMs,
  createLoginToken,
  verifyLoginToken,
}
