import { ApiError, type ClientErrorCode } from '../models/api-error'

const GENERIC_MSG = 'Something went wrong. Please try again.'

const ERROR_MSG_MAP: Record<ClientErrorCode, string> = {
  VALIDATION_FAILED: 'Some details are invalid.',
  ROUTE_NOT_FOUND: GENERIC_MSG, // FE called an endpoint that doesn't exist - a bug, not the user's fault

  CAT_NOT_FOUND: "Cat doesn't exist (anymore).",

  INVALID_CREDENTIALS: 'Wrong username or password.', // deliberately vague - don't reveal which one was wrong
  USERNAME_TAKEN: 'This username is already taken.',
  UNAUTHORIZED: 'Please log in to continue.',
  FORBIDDEN: "You don't have permission to do that.",

  INTERNAL: GENERIC_MSG,
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

export const errorService = {
  ERROR_MSG_MAP,
  getErrorMsg,
}
