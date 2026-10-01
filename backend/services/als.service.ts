import { AsyncLocalStorage } from 'node:async_hooks'
import type { LoggedInUser } from '@cat-store/shared'

// Per-request context - readable anywhere down the call chain (services, logger) without passing req/res around
export interface AlsStore {
    requestId: string
    // Set from the JWT alone (no DB) on every request - fine for logs, NOT for permission checks.
    // requireAuth replaces it with the fresh user from the DB (up-to-date isAdmin, deleted users rejected).
    loggedInUser: LoggedInUser | null
}

const asyncLocalStorage = new AsyncLocalStorage<AlsStore>()

// Throws instead of returning undefined - outside a request context is always a bug
// (e.g. setupAsyncLocalStorage isn't mounted before the code that reads the store)
function getStore(): AlsStore {
    const store = asyncLocalStorage.getStore()
    if (!store) throw new Error('No ALS store - called outside a request context')
    return store
}

// Non-throwing - for the error handler, which must never throw itself
// (a throw there would swallow the original error and skip our JSON response)
function getRequestId(): string | undefined {
    return asyncLocalStorage.getStore()?.requestId
}

export const alsService = {
    run: asyncLocalStorage.run.bind(asyncLocalStorage),
    getStore,
    getRequestId,
}
