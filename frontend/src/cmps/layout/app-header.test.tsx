import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { LoggedInUser } from '@cat-store/shared'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../models/api-error'
import { authService } from '../../services/auth.service'
import { useLoggedInUserStore } from '../../store/logged-in-user.store'
import { useUserMsgStore } from '../../store/user-msg.store'
import { AppHeader } from './app-header'

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
      { path: '/', element: <p>Home</p> },
      { path: '/cat', element: <AppHeader /> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return { router, user: userEvent.setup() }
}

describe('AppHeader', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useLoggedInUserStore.setState({ loggedInUser: null })
    useUserMsgStore.setState({ msg: null, navigationMsg: null })
  })

  it('shows a guest a Login link back to the current page', () => {
    _renderAt('/cat?txt=Mitzi')

    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute(
      'href',
      `/login?redirectTo=${encodeURIComponent('/cat?txt=Mitzi')}`,
    )
    expect(screen.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument()
  })

  it('greets a logged-in user by first name', () => {
    useLoggedInUserStore.setState({ loggedInUser: _USER })
    _renderAt('/cat')

    expect(screen.getByText('Hi, Ori')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Login' })).not.toBeInTheDocument()
  })

  it('logs out, clears the user and goes home', async () => {
    useLoggedInUserStore.setState({ loggedInUser: _USER })
    const { router, user } = _renderAt('/cat')

    await user.click(screen.getByRole('button', { name: 'Logout' }))

    expect(authService.logout).toHaveBeenCalled()
    expect(useLoggedInUserStore.getState().loggedInUser).toBeNull()
    expect(useUserMsgStore.getState().msg).toMatchObject({ txt: 'Logged out', type: 'success' })
    expect(await screen.findByText('Home')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
  })

  it('stays logged in and shows the error when logout fails', async () => {
    vi.mocked(authService.logout).mockRejectedValue(
      new ApiError(0, 'NETWORK_ERROR', 'Network Error'),
    )
    useLoggedInUserStore.setState({ loggedInUser: _USER })
    const { router, user } = _renderAt('/cat')

    await user.click(screen.getByRole('button', { name: 'Logout' }))

    expect(useLoggedInUserStore.getState().loggedInUser).toEqual(_USER)
    expect(useUserMsgStore.getState().msg).toMatchObject({
      txt: "Can't reach the server. Check your connection.",
      type: 'error',
    })
    expect(router.state.location.pathname).toBe('/cat')
  })
})
