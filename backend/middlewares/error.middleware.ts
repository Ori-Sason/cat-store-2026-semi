import { type ErrorRequestHandler } from 'express'
import type { ApiErrorBody } from '@cat-store/shared'
import { alsService } from '../services/als.service.ts'
import { errorService } from '../services/error.service.ts'

// Central error handler - must be registered after all routes.
// Express recognizes it as an error handler by its 4 arguments (err, req, res, next).
// Every error leaves here in the same shape: ApiErrorBody.
export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  // Response already started streaming - can't send a new status, let Express close the connection
  if (res.headersSent) return next(err)

  const { status, body } = errorService.toErrorResponse(err)
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
