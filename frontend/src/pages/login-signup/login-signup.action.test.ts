import type { LoggedInUser } from '@cat-store/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../models/api-error'
import { authService } from '../../services/auth.service'
import { useLoggedInUserStore } from '../../store/logged-in-user.store'
import { useUserMsgStore } from '../../store/user-msg.store'
import { loginSignupAction } from './login-signup.action'

vi.mock('../../services/auth.service')

const _USER = {
  _id: 'user-1',
  username: 'ori',
  fullname: 'Ori Sason',
  isAdmin: false,
} satisfies LoggedInUser

const _LOGIN_INPUT = { username: 'ori', password: 'secret', isRemembered: false }
const _SIGNUP_INPUT = {
  fullname: 'Ori Sason',
  username: 'ori',
  password: 'Secret1!',
  isRemembered: true,
}

const msgStore = () => useUserMsgStore.getState()

function _request(path: string, body: unknown) {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function _location(result: unknown) {
  return (result as Response).headers.get('Location')
}

describe('loginSignupAction', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useUserMsgStore.setState({ msg: null, navigationMsg: null })
    useLoggedInUserStore.setState({ loggedInUser: null })
    vi.mocked(authService.login).mockResolvedValue(_USER)
    vi.mocked(authService.signup).mockResolvedValue(_USER)
  })

  it('logs in in login mode, sets the user and redirects to /cat', async () => {
    const result = await loginSignupAction({ request: _request('/login', _LOGIN_INPUT) }, 'login')

    expect(authService.login).toHaveBeenCalledWith(_LOGIN_INPUT)
    expect(authService.signup).not.toHaveBeenCalled()
    expect(useLoggedInUserStore.getState().loggedInUser).toEqual(_USER)
    expect(msgStore().navigationMsg).toMatchObject({ txt: 'Welcome, Ori Sason', type: 'success' })
    expect(_location(result)).toBe('/cat')
  })

  it('signs up in signup mode', async () => {
    await loginSignupAction({ request: _request('/signup', _SIGNUP_INPUT) }, 'signup')

    expect(authService.signup).toHaveBeenCalledWith(_SIGNUP_INPUT)
    expect(authService.login).not.toHaveBeenCalled()
    expect(useLoggedInUserStore.getState().loggedInUser).toEqual(_USER)
  })

  it('redirects to a safe redirectTo', async () => {
    const path = `/login?redirectTo=${encodeURIComponent('/cat/cat-1?txt=Mitzi')}`

    const result = await loginSignupAction({ request: _request(path, _LOGIN_INPUT) }, 'login')

    expect(_location(result)).toBe('/cat/cat-1?txt=Mitzi')
  })

  it('ignores a redirectTo that leaves the site', async () => {
    const path = `/signup?redirectTo=${encodeURIComponent('//evil.com')}`

    const result = await loginSignupAction({ request: _request(path, _SIGNUP_INPUT) }, 'signup')

    expect(_location(result)).toBe('/cat')
  })

  it('shows the error and stays on the page when login fails', async () => {
    vi.mocked(authService.login).mockRejectedValue(
      new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid credentials'),
    )

    const result = await loginSignupAction({ request: _request('/login', _LOGIN_INPUT) }, 'login')

    expect(result).toMatchObject({ data: null, init: { status: 401 } })
    expect(msgStore().msg).toMatchObject({ txt: 'Wrong username or password.', type: 'error' })
    expect(msgStore().navigationMsg).toBeNull()
    expect(useLoggedInUserStore.getState().loggedInUser).toBeNull()
  })
})
