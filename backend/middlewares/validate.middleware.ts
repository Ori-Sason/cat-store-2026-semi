import type { RequestHandler } from 'express'
import { z } from 'zod'
import { HttpError } from '../models/http-error.ts'

// Validates req.body against a Zod schema, then swaps in the parsed result.
// Zod strips unknown keys, so server-set fields (_id, createdAt, ...) never reach the controller
export function validateBody(schema: z.ZodType): RequestHandler {
  return (req, res, next) => {
    const result = schema.safeParse(req.body)
    if (!result.success) {
      const { fieldErrors } = z.flattenError(result.error)
      throw new HttpError(400, 'VALIDATION_FAILED', 'Invalid request body', fieldErrors)
    }
    req.body = result.data
    next()
  }
}
