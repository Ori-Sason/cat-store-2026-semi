import { AsyncLocalStorage } from 'node:async_hooks'
import type { LoggedInUser } from '@cat-store/shared'

// Per-request context - readable anywhere down the call chain (services, logger) without passing req/res around.
// A socket event gets its own store too (one per event, not per connection), so services read it the same way
export interface AlsStore {
  requestId: string
  // The socket the event came on, so log lines can show everything one socket did. null for HTTP
  socketId: string | null
  // Set by attachTokenUser from the JWT alone (no DB) on every request. Can be up to 7 days
  // stale (isAdmin revoked, user deleted) - fine for logs and /me's lookup, NOT for permission checks
  tokenUser: LoggedInUser | null
  // Set only by requireAuth (HTTP) or requireSocketUser (socket), re-read from the DB
  // (up-to-date isAdmin, deleted users rejected). Read it through getVerifiedUser(), never directly
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

// For permission checks and controllers. Keys on the auth step having run (requireAuth, or
// requireSocketUser for a socket event), not on a user happening to be there: with only the token
// user set, it still throws. A plain Error (→ 500), since a missing auth step is a bug, not the
// client's fault. Bundling requireAuth into every require* is the first layer; this catches a
// check written without it
function getVerifiedUser(): LoggedInUser {
  const { verifiedUser } = getStore()
  if (!verifiedUser) {
    throw new Error('No verified user - the route or socket event is missing its auth step')
  }
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
