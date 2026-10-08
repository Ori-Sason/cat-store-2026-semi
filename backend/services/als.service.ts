import { AsyncLocalStorage } from 'node:async_hooks'
import type { LoggedInUser } from '@cat-store/shared'

// Per-request context - readable anywhere down the call chain (services, logger) without passing req/res around
export interface AlsStore {
  requestId: string
  // Set by attachTokenUser from the JWT alone (no DB) on every request. Can be up to 7 days
  // stale (isAdmin revoked, user deleted) - fine for logs and /me's lookup, NOT for permission checks
  tokenUser: LoggedInUser | null
  // Set only by requireAuth, re-read from the DB (up-to-date isAdmin, deleted users rejected).
  // Read it through getVerifiedUser(), never directly
  verifiedUser: LoggedInUser | null
}

const asyncLocalStorage = new AsyncLocalStorage<AlsStore>()

// Throws instead of returning undefined - outside a request context is always a bug
// (e.g. setupAsyncLocalStorage isn't mounted before the code that reads the store)
function getStore(): AlsStore {
  const store = asyncLocalStorage.getStore()
  if (!store) throw new Error('No ALS store - called outside a request context')
  return store
}

// For permission checks and controllers. Keys on requireAuth having run, not on a user happening
// to be there: with only the token user set, it still throws. A plain Error (→ 500), since a
// route missing requireAuth is a bug, not the client's fault. Bundling requireAuth into every
// require* is the first layer; this catches a check written without it
function getVerifiedUser(): LoggedInUser {
  const { verifiedUser } = getStore()
  if (!verifiedUser) throw new Error('No verified user - the route is missing requireAuth')
  return verifiedUser
}

// Non-throwing - for the error handler, which must never throw itself
// (a throw there would swallow the original error and skip our JSON response)
function getRequestId(): string | undefined {
  return asyncLocalStorage.getStore()?.requestId
}

export const alsService = {
  run: asyncLocalStorage.run.bind(asyncLocalStorage),
  getStore,
  getVerifiedUser,
  getRequestId,
}
