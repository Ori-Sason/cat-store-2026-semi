import { describe, expect, it } from 'vitest'
import { ApiError } from '../models/api-error'
import { errorService } from './error.service'

const { ERROR_MSG_MAP, getErrorMsg } = errorService
const REQUEST_ID = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890'

describe('errorService.getErrorMsg', () => {
  it('returns the mapped msg for an ApiError code', () => {
    const err = new ApiError(404, 'CAT_NOT_FOUND', 'Cat not found')

    expect(getErrorMsg(err)).toBe(ERROR_MSG_MAP.CAT_NOT_FOUND)
  })

  it('returns the generic msg for an error that is not an ApiError', () => {
    expect(getErrorMsg(new Error('boom'))).toBe(ERROR_MSG_MAP.UNKNOWN)
  })

  it('prefers an override over the mapped msg', () => {
    const err = new ApiError(400, 'VALIDATION_FAILED', 'Invalid id')

    expect(getErrorMsg(err, { VALIDATION_FAILED: 'This cat link is broken.' })).toBe(
      'This cat link is broken.',
    )
  })

  it('appends a short ref for a developer-fault code with a requestId', () => {
    const err = new ApiError(500, 'INTERNAL', 'Internal error', undefined, REQUEST_ID)

    expect(getErrorMsg(err)).toBe(`${ERROR_MSG_MAP.INTERNAL}\nRef: a1b2c3d4`)
  })

  it('skips the ref for a developer-fault code without a requestId', () => {
    const err = new ApiError(500, 'INTERNAL', 'Internal error')

    expect(getErrorMsg(err)).toBe(ERROR_MSG_MAP.INTERNAL)
  })

  it('skips the ref for a user-fault code, even with a requestId', () => {
    const err = new ApiError(401, 'INVALID_CREDENTIALS', 'Bad login', undefined, REQUEST_ID)

    expect(getErrorMsg(err)).toBe(ERROR_MSG_MAP.INVALID_CREDENTIALS)
  })
})
