// Machine-readable error codes - the FE branches on these and maps them to user text.
// Add a code only when some route can actually return it.
export const ERROR_CODES = [
  'VALIDATION_FAILED',
  'ROUTE_NOT_FOUND',
  
  'CAT_NOT_FOUND',
  
  'INVALID_CREDENTIALS',
  'USERNAME_TAKEN',
  'UNAUTHORIZED',
  'FORBIDDEN',
  
  'INTERNAL',
] as const

export type ErrorCode = (typeof ERROR_CODES)[number]

export interface ApiErrorBody {
  code: ErrorCode
  message: string //developer-facing (logs / Postman) - the FE picks user text by code.
  fieldErrors?: Record<string, string[]>
  requestId?: string
}
