import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { LoggedInUser } from '@cat-store/shared'
import { createMemoryRouter, Outlet, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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

// The header sits in a layout route, so it stays mounted across navigations like in the app
function _renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        element: (
          <>
            <AppHeader />
            <Outlet />
          </>
        ),
        children: [
          { path: '/', element: <p>Home</p> },
          { path: '/cat', element: <p>Cats page</p> },
          { path: '/about', element: <p>About page</p> },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return { router, user: userEvent.setup() }
}

function _getAvatarBtn() {
  return screen.getByRole('button', { name: 'Menu' })
}

async function _openAccountMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(_getAvatarBtn())
  expect(_getAvatarBtn()).toHaveAttribute('aria-expanded', 'true')
}

describe('AppHeader', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useLoggedInUserStore.setState({ loggedInUser: null })
    useUserMsgStore.setState({ msg: null, navigationMsg: null })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('shows a guest a Login link back to the current page', () => {
    _renderAt('/cat?txt=Mitzi')

    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute(
      'href',
      `/login?redirectTo=${encodeURIComponent('/cat?txt=Mitzi')}`,
    )
    expect(screen.queryByRole('button', { name: 'Menu' })).not.toBeInTheDocument()
  })

  it('shows a logged-in user an avatar with their initial, menu closed', () => {
    useLoggedInUserStore.setState({ loggedInUser: _USER })
    _renderAt('/cat')

    expect(_getAvatarBtn()).toHaveTextContent('O')
    expect(_getAvatarBtn()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Hi, Ori!')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Login' })).not.toBeInTheDocument()
  })

  it('opens the account card with the greeting, full name and username', async () => {
    useLoggedInUserStore.setState({ loggedInUser: _USER })
    const { user } = _renderAt('/cat')

    await _openAccountMenu(user)

    expect(screen.getByText('Hi, Ori!')).toBeInTheDocument()
    expect(screen.getByText('Ori Sason · @ori')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Logout' })).toBeInTheDocument()
    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
  })

  it('marks an admin in the account card', async () => {
    useLoggedInUserStore.setState({ loggedInUser: { ..._USER, isAdmin: true } })
    const { user } = _renderAt('/cat')

    await _openAccountMenu(user)

    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('closes the card on a second avatar click', async () => {
    useLoggedInUserStore.setState({ loggedInUser: _USER })
    const { user } = _renderAt('/cat')
    await _openAccountMenu(user)

    await user.click(_getAvatarBtn())

    expect(_getAvatarBtn()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Hi, Ori!')).not.toBeInTheDocument()
  })

  it('closes the card on Escape and puts focus back on the avatar', async () => {
    useLoggedInUserStore.setState({ loggedInUser: _USER })
    const { user } = _renderAt('/cat')
    await _openAccountMenu(user)

    await user.keyboard('{Escape}')

    expect(screen.queryByText('Hi, Ori!')).not.toBeInTheDocument()
    expect(_getAvatarBtn()).toHaveFocus()
  })

  it('closes the card on a click outside it', async () => {
    useLoggedInUserStore.setState({ loggedInUser: _USER })
    const { user } = _renderAt('/cat')
    await _openAccountMenu(user)

    await user.click(screen.getByText('Cats page'))

    expect(screen.queryByText('Hi, Ori!')).not.toBeInTheDocument()
  })

  it('closes the card on a route change', async () => {
    useLoggedInUserStore.setState({ loggedInUser: _USER })
    const { router, user } = _renderAt('/cat')
    await _openAccountMenu(user)

    await act(() => router.navigate('/about'))

    expect(screen.getByText('About page')).toBeInTheDocument()
    expect(screen.queryByText('Hi, Ori!')).not.toBeInTheDocument()
  })

  it('closes the card when the screen crosses the breakpoint', async () => {
    let onBreakpointChange = () => {}
    vi.spyOn(window, 'matchMedia').mockReturnValue({
      addEventListener: (_type: string, listener: () => void) => {
        onBreakpointChange = listener
      },
      removeEventListener: () => {},
    } as unknown as MediaQueryList)
    useLoggedInUserStore.setState({ loggedInUser: _USER })
    const { user } = _renderAt('/cat')
    await _openAccountMenu(user)

    act(() => onBreakpointChange())

    expect(screen.queryByText('Hi, Ori!')).not.toBeInTheDocument()
  })

  it('logs out from the card, clears the user and goes home', async () => {
    useLoggedInUserStore.setState({ loggedInUser: _USER })
    const { router, user } = _renderAt('/cat')
    await _openAccountMenu(user)

    await user.click(screen.getByRole('button', { name: 'Logout' }))

    expect(authService.logout).toHaveBeenCalled()
    expect(useLoggedInUserStore.getState().loggedInUser).toBeNull()
    expect(useUserMsgStore.getState().msg).toMatchObject({ txt: 'Logged out', type: 'success' })
    expect(await screen.findByText('Home')).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/')
    expect(screen.getByRole('link', { name: 'Login' })).toBeInTheDocument()
  })

  it('stays logged in and shows the error when logout fails', async () => {
    vi.mocked(authService.logout).mockRejectedValue(
      new ApiError(0, 'NETWORK_ERROR', 'Network Error'),
    )
    useLoggedInUserStore.setState({ loggedInUser: _USER })
    const { router, user } = _renderAt('/cat')
    await _openAccountMenu(user)

    await user.click(screen.getByRole('button', { name: 'Logout' }))

    expect(useLoggedInUserStore.getState().loggedInUser).toEqual(_USER)
    expect(useUserMsgStore.getState().msg).toMatchObject({
      txt: "Can't reach the server. Check your connection.",
      type: 'error',
    })
    expect(router.state.location.pathname).toBe('/cat')
    expect(_getAvatarBtn()).toBeInTheDocument()
  })
})
