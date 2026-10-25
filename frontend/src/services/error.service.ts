import { ERROR_CODES, type ApiErrorBody } from '@cat-store/shared'
import { ApiError, type ClientErrorCode } from '../models/api-error'

const GENERIC_MSG = 'Something went wrong. Please try again.'

const ERROR_MSG_MAP: Record<ClientErrorCode, string> = {
  VALIDATION_FAILED: 'Some details are invalid.',
  PAYLOAD_TOO_LARGE: 'That is too much data to send.',
  ROUTE_NOT_FOUND: GENERIC_MSG, // FE called an endpoint that doesn't exist - a bug, not the user's fault

  CAT_NOT_FOUND: "Cat doesn't exist (anymore).",
  REVIEW_NOT_FOUND: "Review doesn't exist (anymore).",
  USER_NOT_FOUND: "User doesn't exist (anymore).",
  CHAT_MSG_NOT_FOUND: "Message doesn't exist (anymore).",

  INVALID_CREDENTIALS: 'Wrong username or password.', // deliberately vague - don't reveal which one was wrong
  USERNAME_TAKEN: 'This username is already taken.',
  UNAUTHORIZED: 'Please log in to continue.',
  FORBIDDEN: "You don't have permission to do that.",

  INTERNAL: GENERIC_MSG,
  // Only GET /api/health returns it, and the FE never calls that. The map must cover every code
  SERVICE_UNAVAILABLE: GENERIC_MSG,
  NETWORK_ERROR: "Can't reach the server. Check your connection.",
  UNKNOWN: GENERIC_MSG,
}

// Codes that mean "developer fault" - the user gets a reference to quote when reporting it
const REF_CODES: ClientErrorCode[] = ['INTERNAL', 'UNKNOWN', 'ROUTE_NOT_FOUND']

type ErrorMsgOverrides = Partial<Record<ClientErrorCode, string>>

// Picks the text to show the user for any caught error.
// overrides - context-specific wording, e.g. a bad id in the URL means "not found" to the user.
const getErrorMsg = (err: unknown, overrides: ErrorMsgOverrides = {}) => {
  if (!(err instanceof ApiError)) return GENERIC_MSG

  const msg = overrides[err.code] ?? ERROR_MSG_MAP[err.code]
  if (!REF_CODES.includes(err.code) || !err.requestId) return msg

  return `${msg}\nRef: ${err.requestId.slice(0, 8)}`
}

// Whether a response body (HTTP) or an ack's error (socket) is our ApiErrorBody, and not e.g. an
// HTML 502 page from a proxy
function isApiErrorBody(data: unknown): data is ApiErrorBody {
  return (
    typeof data === 'object' &&
    data !== null &&
    'code' in data &&
    typeof data.code === 'string' &&
    (ERROR_CODES as readonly string[]).includes(data.code)
  )
}

export const errorService = {
  ERROR_MSG_MAP,
  getErrorMsg,
  isApiErrorBody,
}
