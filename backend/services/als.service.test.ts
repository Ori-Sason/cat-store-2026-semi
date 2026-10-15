import { describe, expect, it } from 'vitest'
import type { LoggedInUser } from '@cat-store/shared'
import { alsService, type AlsStore } from './als.service.ts'

const USER: LoggedInUser = {
  _id: 'a'.repeat(24),
  username: 'mitzi',
  fullname: 'Mitzi',
  isAdmin: false,
}

// Runs getVerifiedUser inside a hand-built store, the way a request would
function _getVerifiedUserIn(store: Omit<AlsStore, 'requestId' | 'socketId'>) {
  return alsService.run({ requestId: 'test-request', socketId: null, ...store }, () =>
    alsService.getVerifiedUser(),
  )
}

describe('alsService.getVerifiedUser', () => {
  it('returns the verified user once requireAuth set it', () => {
    expect(_getVerifiedUserIn({ tokenUser: USER, verifiedUser: USER })).toEqual(USER)
  })

  // The bug it guards: a token user alone (the auth step never ran) must not count as verified
  it('throws when only the token user is set', () => {
    expect(() => _getVerifiedUserIn({ tokenUser: USER, verifiedUser: null })).toThrow(
      'No verified user',
    )
  })

  it('throws for a guest', () => {
    expect(() => _getVerifiedUserIn({ tokenUser: null, verifiedUser: null })).toThrow(
      'No verified user',
    )
  })
})
