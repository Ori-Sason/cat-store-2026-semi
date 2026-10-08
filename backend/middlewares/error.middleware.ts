import { type ErrorRequestHandler } from 'express'
import type { ApiErrorBody } from '@cat-store/shared'
import { HttpError } from '../models/http-error.ts'
import { alsService } from '../services/als.service.ts'

// Central error handler - must be registered after all routes.
// Express recognizes it as an error handler by its 4 arguments (err, req, res, next).
// Every error leaves here in the same shape: ApiErrorBody.
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  // Response already started streaming - can't send a new status, let Express close the connection
  if (res.headersSent) return next(err)

  const { status, body } = _toErrorResponse(err)
  const requestId = alsService.getRequestId() // undefined only if the error happened before the ALS store existed

  const logLine = `[${requestId ?? 'no-request-id'}] ${req.method} ${req.originalUrl} -> ${status} ${body.code}`
  if (status >= 500) {
    console.error(logLine)
    console.error(err) // unexpected - we want the stack
  } else {
    console.warn(`${logLine}: ${body.message}`) // expected client error - one line is enough
  }

  // requestId goes to the client too - the FE shows it as "Ref: ab12cd34" so a user report maps to this log line
  const response: ApiErrorBody = requestId ? { ...body, requestId } : body
  res.status(status).json(response)
}

const _toErrorResponse = (err: any): { status: number; body: ApiErrorBody } => {
  // Thrown on purpose by our code
  if (err instanceof HttpError) {
    const body: ApiErrorBody = { code: err.code, message: err.message }
    if (err.fieldErrors) body.fieldErrors = err.fieldErrors
    return { status: err.status, body }
  }

  // express.json() couldn't parse the request body
  if (err?.type === 'entity.parse.failed') {
    return { status: 400, body: { code: 'VALIDATION_FAILED', message: 'Malformed JSON body' } }
  }

  // express.json() rejected a body over its limit (100kb by default). A client error, not a 500
  if (err?.type === 'entity.too.large') {
    return { status: 413, body: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body too large' } }
  }

  // Anything else is a bug or an infra failure - don't leak internals in production
  const message =
    process.env.NODE_ENV === 'production' ? 'Internal server error' : (err?.message ?? String(err))
  return { status: 500, body: { code: 'INTERNAL', message } }
}
