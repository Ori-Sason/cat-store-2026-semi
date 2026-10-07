import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { LoggedInUser } from '@cat-store/shared'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../models/api-error'
import { authService } from '../../services/auth.service'
import { useLoggedInUserStore } from '../../store/logged-in-user.store'
import { useUserMsgStore } from '../../store/user-msg.store'
import { LoginSignup } from './login-signup'
import { loginSignupAction } from './login-signup.action'

vi.mock('../../services/auth.service')

const _USER = {
  _id: 'user-1',
  username: 'ori',
  fullname: 'Ori Sason',
  isAdmin: false,
} satisfies LoggedInUser

function _renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/cat', element: <p>Cat list</p> },
      { path: '/cat/:id', element: <p>Cat details</p> },
      {
        path: '/login',
        action: (args) => loginSignupAction(args, 'login'),
        element: <LoginSignup mode="login" />,
      },
      {
        path: '/signup',
        action: (args) => loginSignupAction(args, 'signup'),
        element: <LoginSignup mode="signup" />,
      },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return { router, user: userEvent.setup() }
}

// Compare the decoded value - the link may encode '/' as %2F, which means the same
function _getRedirectTo(router: ReturnType<typeof createMemoryRouter>) {
  return new URLSearchParams(router.state.location.search).get('redirectTo')
}

describe('LoginSignup', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useLoggedInUserStore.setState({ loggedInUser: null })
    useUserMsgStore.setState({ msg: null, navigationMsg: null })
  })

  it('switches to signup and back, keeping redirectTo and resetting the form', async () => {
    const { router, user } = _renderAt('/login?redirectTo=/cat/cat-1')

    await user.type(await screen.findByLabelText('Username'), 'ori')
    await user.click(screen.getByRole('link', { name: 'Sign up' }))

    expect(await screen.findByRole('heading', { name: 'Sign up' })).toBeInTheDocument()
    expect(_getRedirectTo(router)).toBe('/cat/cat-1')
    expect(screen.getByLabelText('Username')).toHaveValue('')

    await user.click(screen.getByRole('link', { name: 'Log in' }))

    expect(await screen.findByRole('heading', { name: 'Log in' })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/login')
    expect(_getRedirectTo(router)).toBe('/cat/cat-1')
  })

  it('goes back to redirectTo', async () => {
    const { user } = _renderAt('/signup?redirectTo=/cat/cat-1')

    await user.click(await screen.findByRole('link', { name: '← Back' }))

    expect(await screen.findByText('Cat details')).toBeInTheDocument()
  })

  it('goes back to /cat without a redirectTo', async () => {
    const { user } = _renderAt('/login')

    await user.click(await screen.findByRole('link', { name: '← Back' }))

    expect(await screen.findByText('Cat list')).toBeInTheDocument()
  })

  it('logs in and lands on redirectTo', async () => {
    vi.mocked(authService.login).mockResolvedValue(_USER)
    const { router, user } = _renderAt('/login?redirectTo=/cat/cat-1')

    await user.type(await screen.findByLabelText('Username'), 'ori')
    await user.type(screen.getByLabelText('Password'), 'secret')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    expect(await screen.findByText('Cat details')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/cat/cat-1')
    expect(useLoggedInUserStore.getState().loggedInUser).toEqual(_USER)
  })

  it('keeps the form filled when login fails', async () => {
    vi.mocked(authService.login).mockRejectedValue(
      new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid credentials'),
    )
    const { router, user } = _renderAt('/login')

    await user.type(await screen.findByLabelText('Username'), 'ori')
    await user.type(screen.getByLabelText('Password'), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Log in' }))

    await waitFor(() => expect(useUserMsgStore.getState().msg?.type).toBe('error'))
    expect(router.state.location.pathname).toBe('/login')
    expect(screen.getByLabelText('Username')).toHaveValue('ori')
  })
})
