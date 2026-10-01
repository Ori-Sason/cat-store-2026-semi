import type { ErrorCode } from '@cat-store/shared'

export type ClientErrorCode = ErrorCode | 'NETWORK_ERROR' | 'UNKNOWN'

// The only error type pages see from the http layer - they never deal with Axios directly
export class ApiError extends Error {
  status: number // 0 = no response (server down, offline)
  code: ClientErrorCode
  fieldErrors: Record<string, string[]> | undefined
  requestId: string | undefined

  constructor(
    status: number,
    code: ClientErrorCode,
    message: string,
    fieldErrors?: Record<string, string[]>,
    requestId?: string,
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
    this.requestId = requestId
  }
}
