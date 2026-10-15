import jwt from 'jsonwebtoken'
import type { LoggedInUser } from '@cat-store/shared'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { config } from '../../config/index.ts'
import { SESSION_LOGIN_TTL_MS, authService } from './auth.service.ts'

const LOGGED_IN_USER: LoggedInUser = {
  _id: '652f1c2e9b1e8a3d4c5b6a79',
  username: 'mitzi',
  fullname: 'Mitzi',
  isAdmin: false,
}

const NOW_MS = Date.UTC(2026, 9, 15)

afterEach(() => {
  vi.useRealTimers()
})

describe('authService.verifyLoginToken', () => {
  it('returns the user, without iat and exp', () => {
    const loginToken = authService.createLoginToken(LOGGED_IN_USER, false)
    expect(authService.verifyLoginToken(loginToken)).toEqual(LOGGED_IN_USER)
  })

  it('returns null for a tampered token', () => {
    const loginToken = authService.createLoginToken(LOGGED_IN_USER, false)
    expect(authService.verifyLoginToken(`${loginToken}x`)).toBeNull()
  })
})

describe('authService.verifyLoginTokenWithExp', () => {
  it('returns the user and exp in seconds', () => {
    vi.useFakeTimers({ now: NOW_MS })
    const loginToken = authService.createLoginToken(LOGGED_IN_USER, false)

    expect(authService.verifyLoginTokenWithExp(loginToken)).toEqual({
      loggedInUser: LOGGED_IN_USER,
      exp: (NOW_MS + SESSION_LOGIN_TTL_MS) / 1000,
    })
  })

  it('returns null for an expired token', () => {
    vi.useFakeTimers({ now: NOW_MS })
    const loginToken = authService.createLoginToken(LOGGED_IN_USER, false)
    vi.setSystemTime(NOW_MS + SESSION_LOGIN_TTL_MS + 1000)

    expect(authService.verifyLoginTokenWithExp(loginToken)).toBeNull()
  })

  it('returns null for a token signed with another secret', () => {
    const loginToken = jwt.sign(LOGGED_IN_USER, 'another-secret', { expiresIn: 60 })
    expect(authService.verifyLoginTokenWithExp(loginToken)).toBeNull()
  })

  it('returns null for a token with no exp', () => {
    const loginToken = jwt.sign(LOGGED_IN_USER, config.jwtSecret, { algorithm: 'HS256' })
    expect(authService.verifyLoginTokenWithExp(loginToken)).toBeNull()
  })
})
