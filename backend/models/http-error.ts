import type { ErrorCode } from '@cat-store/shared'

// The one error type we throw for expected failures (404, 400, ...).
// The error middleware turns it into an ApiErrorBody response.
export class HttpError extends Error {
  status: number
  code: ErrorCode
  fieldErrors: Record<string, string[]> | undefined

  constructor(
    status: number,
    code: ErrorCode,
    message: string,
    fieldErrors?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
  }
}
