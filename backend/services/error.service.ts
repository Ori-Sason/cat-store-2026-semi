import type { ApiErrorBody } from '@cat-store/shared'
import { HttpError } from '../models/http-error.ts'

// Any thrown value → its status and ApiErrorBody. Shared by the HTTP error middleware and the
// socket event wrapper (socketService.on), so both answer with the same shape and codes
function toErrorResponse(err: any): { status: number; body: ApiErrorBody } {
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

export const errorService = {
  toErrorResponse,
}
