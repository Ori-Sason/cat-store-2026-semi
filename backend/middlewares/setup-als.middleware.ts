import type { RequestHandler } from 'express'
import { randomUUID } from 'node:crypto'
import { alsService, type AlsStore } from '../services/als.service.ts'

// Must be the first middleware - everything after it runs inside the request's store.
// Tags every request with an ID - it's logged with errors and sent back to the client,
// so a user's "Ref: ab12cd34" can be traced to the exact server log line.
// Always generated here - a client-sent ID isn't trusted.
export const setupAsyncLocalStorage: RequestHandler = (req, res, next) => {
  const store: AlsStore = { requestId: randomUUID(), tokenUser: null, verifiedUser: null }
  res.setHeader('X-Request-Id', store.requestId)
  alsService.run(store, next)
}
