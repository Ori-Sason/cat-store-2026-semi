import type { RequestHandler } from 'express'
import type { z } from 'zod'
import { utilService } from '../../services/util.service.ts'

// Validates req.body against a Zod schema, then swaps in the parsed result.
// Zod strips unknown keys, so server-set fields (_id, createdAt, ...) never reach the controller
export function validateBody(schema: z.ZodType): RequestHandler {
  return (req, res, next) => {
    req.body = utilService.parseOrThrow(schema, req.body, 'request body')
    next()
  }
}

// Same for req.query. Express 5 makes req.query a getter that re-parses the URL on every read,
// so assigning to it throws. defineProperty shadows the getter on this request only.
// writable + configurable (defineProperty defaults both to false), so a second validateQuery
// or a later middleware can still replace it instead of throwing a 500
export function validateQuery(schema: z.ZodType): RequestHandler {
  return (req, res, next) => {
    Object.defineProperty(req, 'query', {
      value: utilService.parseOrThrow(schema, req.query, 'request query'),
      writable: true,
      configurable: true,
    })
    next()
  }
}
