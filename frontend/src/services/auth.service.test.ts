import type { LoggedInUser } from '@cat-store/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useLoggedInUserStore } from '../store/logged-in-user.store'
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

  describe('the logged-in user', () => {
    beforeEach(() => {
      useLoggedInUserStore.setState(useLoggedInUserStore.getInitialState())
    })

    it('loads the user from /me into the store', async () => {
      vi.mocked(httpService.get).mockResolvedValue(_USER)

      await authService.loadLoggedInUser()

      expect(useLoggedInUserStore.getState().loggedInUser).toEqual(_USER)
    })

    it('clears the store when /me returns a guest', async () => {
      useLoggedInUserStore.getState().setLoggedInUser(_USER)
      vi.mocked(httpService.get).mockResolvedValue(null)

      await authService.loadLoggedInUser()

      expect(useLoggedInUserStore.getState().loggedInUser).toBeNull()
    })
  })

  // A second channel stands in for another tab. Messages between channels are async
  describe('other tabs', () => {
    let otherTab: BroadcastChannel
    let otherTabMsgCount: number

    beforeEach(() => {
      useLoggedInUserStore.setState(useLoggedInUserStore.getInitialState())
      otherTabMsgCount = 0
      otherTab = new BroadcastChannel('auth')
      otherTab.onmessage = () => otherTabMsgCount++
    })

    afterEach(() => {
      otherTab.close()
    })

    it.each([
      ['login', () => authService.login({ username: 'ori', password: 'x', isRemembered: false })],
      [
        'signup',
        () =>
          authService.signup({
            fullname: 'Ori Sason',
            username: 'ori',
            password: 'Secret1!',
            isRemembered: false,
          }),
      ],
      ['logout', () => authService.logout()],
    ])('tells the other tabs after a %s', async (_name, authAction) => {
      vi.mocked(httpService.post).mockResolvedValue(_USER)

      await authAction()

      await vi.waitFor(() => expect(otherTabMsgCount).toBe(1))
    })

    it('tells the other tabs nothing when the login fails', async () => {
      vi.mocked(httpService.post).mockRejectedValueOnce(new Error('401'))
      await expect(
        authService.login({ username: 'ori', password: 'x', isRemembered: false }),
      ).rejects.toThrow()

      // One channel delivers in order, so once the logout's message lands, a message from the
      // failed login would have landed before it
      await authService.logout()

      await vi.waitFor(() => expect(otherTabMsgCount).toBeGreaterThan(0))
      expect(otherTabMsgCount).toBe(1)
    })

    it('reloads the user from /me when another tab logs in or out', async () => {
      authService.syncLoggedInUserAcrossTabs()
      vi.mocked(httpService.get).mockResolvedValueOnce(_USER).mockResolvedValueOnce(null)

      otherTab.postMessage(null)
      await vi.waitFor(() => expect(useLoggedInUserStore.getState().loggedInUser).toEqual(_USER))

      otherTab.postMessage(null)
      await vi.waitFor(() => expect(useLoggedInUserStore.getState().loggedInUser).toBeNull())
      expect(httpService.get).toHaveBeenCalledTimes(2)
    })

    it('keeps the current user when /me fails', async () => {
      authService.syncLoggedInUserAcrossTabs()
      useLoggedInUserStore.getState().setLoggedInUser(_USER)
      vi.mocked(httpService.get).mockRejectedValue(new Error('network'))

      otherTab.postMessage(null)

      await vi.waitFor(() => expect(httpService.get).toHaveBeenCalled())
      // Let the failed load settle before checking it changed nothing
      await new Promise((resolve) => setTimeout(resolve))
      expect(useLoggedInUserStore.getState().loggedInUser).toEqual(_USER)
    })
  })
})
