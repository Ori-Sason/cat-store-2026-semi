import type { LoggedInUser } from '@cat-store/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authService } from './auth.service'
import { httpService } from './http.service'

vi.mock('./http.service')

const _USER = {
  _id: 'user-1',
  username: 'ori',
  fullname: 'Ori Sason',
  isAdmin: false,
} satisfies LoggedInUser

describe('authService', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('logs in with the credentials and returns the user', async () => {
    vi.mocked(httpService.post).mockResolvedValue(_USER)
    const credentials = { username: 'ori', password: 'secret', isRemembered: true }

    expect(await authService.login(credentials)).toEqual(_USER)
    expect(httpService.post).toHaveBeenCalledWith('auth/login', credentials)
  })

  it('signs up with the signup input and returns the user', async () => {
    vi.mocked(httpService.post).mockResolvedValue(_USER)
    const signupInput = {
      fullname: 'Ori Sason',
      username: 'ori',
      password: 'Secret1!',
      isRemembered: false,
    }

    expect(await authService.signup(signupInput)).toEqual(_USER)
    expect(httpService.post).toHaveBeenCalledWith('auth/signup', signupInput)
  })

  it('logs out', async () => {
    await authService.logout()

    expect(httpService.post).toHaveBeenCalledWith('auth/logout')
  })

  it('returns the logged-in user from /me, or null for a guest', async () => {
    vi.mocked(httpService.get).mockResolvedValueOnce(_USER).mockResolvedValueOnce(null)

    expect(await authService.getLoggedInUser()).toEqual(_USER)
    expect(await authService.getLoggedInUser()).toBeNull()
    // A short timeout: this call blocks the first render
    expect(httpService.get).toHaveBeenCalledWith('auth/me', undefined, { timeoutMs: 3_000 })
  })
})
