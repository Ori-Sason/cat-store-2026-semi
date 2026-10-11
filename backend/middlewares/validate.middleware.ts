import type { RequestHandler } from 'express'
import { z } from 'zod'
import { HttpError } from '../models/http-error.ts'

// Validates req.body against a Zod schema, then swaps in the parsed result.
// Zod strips unknown keys, so server-set fields (_id, createdAt, ...) never reach the controller
export function validateBody(schema: z.ZodType): RequestHandler {
  return (req, res, next) => {
    req.body = _parse(schema, req.body, 'body')
    next()
  }
}

// Same for req.query. Express 5 makes req.query a getter that re-parses the URL on every read,
// so assigning to it throws. defineProperty shadows the getter on this request only
export function validateQuery(schema: z.ZodType): RequestHandler {
  return (req, res, next) => {
    Object.defineProperty(req, 'query', { value: _parse(schema, req.query, 'query') })
    next()
  }
}

function _parse(schema: z.ZodType, value: unknown, part: 'body' | 'query'): unknown {
  const result = schema.safeParse(value)
  if (result.success) return result.data

  // formErrors are the object-level ones (a .refine across fields), which have no field to sit under
  const { formErrors, fieldErrors } = z.flattenError(result.error)
  const message = [`Invalid request ${part}`, ...formErrors].join(': ')
  throw new HttpError(400, 'VALIDATION_FAILED', message, fieldErrors)
}
