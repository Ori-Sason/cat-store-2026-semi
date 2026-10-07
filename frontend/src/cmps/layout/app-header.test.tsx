import { act, render, screen, within } from '@testing-library/react'
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

function _getMenuBtn() {
  return screen.getByRole('button', { name: 'Menu' })
}

// jsdom ignores the media queries, so the bar's nav and the card's page rows both render.
// Scope to the card through the button's aria-controls
function _getCard() {
  const cardId = _getMenuBtn().getAttribute('aria-controls')!
  return within(document.getElementById(cardId)!)
}

async function _openMenu(user: ReturnType<typeof userEvent.setup>) {
  await user.click(_getMenuBtn())
  expect(_getMenuBtn()).toHaveAttribute('aria-expanded', 'true')
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

  it('shows a guest a Login link in the bar, back to the current page', () => {
    _renderAt('/cat?txt=Mitzi')

    expect(screen.getByRole('link', { name: 'Login' })).toHaveAttribute(
      'href',
      `/login?redirectTo=${encodeURIComponent('/cat?txt=Mitzi')}`,
    )
  })

  it('gives a guest a menu with the pages and a Login link back to the current page', async () => {
    const { user } = _renderAt('/cat?txt=Mitzi')

    // No avatar inside, only the CSS hamburger
    expect(_getMenuBtn().textContent).toBe('')
    await _openMenu(user)

    const card = _getCard()
    expect(card.getByRole('link', { name: 'Cats' })).toBeInTheDocument()
    expect(card.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument()
    expect(card.getByRole('link', { name: 'About' })).toBeInTheDocument()
    expect(card.getByRole('link', { name: 'Login' })).toHaveAttribute(
      'href',
      `/login?redirectTo=${encodeURIComponent('/cat?txt=Mitzi')}`,
    )
    expect(card.queryByRole('button', { name: 'Logout' })).not.toBeInTheDocument()
  })

  it('shows a logged-in user a Menu button with their initial, closed', () => {
    useLoggedInUserStore.setState({ loggedInUser: _USER })
    _renderAt('/cat')

    expect(_getMenuBtn()).toHaveTextContent('O')
    expect(_getMenuBtn()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Hi, Ori!')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Login' })).not.toBeInTheDocument()
  })

  it('opens the card with the greeting, full name, username, pages and Logout', async () => {
    useLoggedInUserStore.setState({ loggedInUser: _USER })
    const { user } = _renderAt('/cat')

    await _openMenu(user)

    const card = _getCard()
    expect(card.getByText('Hi, Ori!')).toBeInTheDocument()
    expect(card.getByText('Ori Sason · @ori')).toBeInTheDocument()
    expect(card.getByRole('link', { name: 'About' })).toBeInTheDocument()
    expect(card.getByRole('button', { name: 'Logout' })).toBeInTheDocument()
    expect(card.queryByRole('link', { name: 'Login' })).not.toBeInTheDocument()
    expect(card.queryByText('Admin')).not.toBeInTheDocument()
  })

  it('marks an admin in the account card', async () => {
    useLoggedInUserStore.setState({ loggedInUser: { ..._USER, isAdmin: true } })
    const { user } = _renderAt('/cat')

    await _openMenu(user)

    expect(screen.getByText('Admin')).toBeInTheDocument()
  })

  it('closes the card on a second Menu click', async () => {
    useLoggedInUserStore.setState({ loggedInUser: _USER })
    const { user } = _renderAt('/cat')
    await _openMenu(user)

    await user.click(_getMenuBtn())

    expect(_getMenuBtn()).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByText('Hi, Ori!')).not.toBeInTheDocument()
  })

  it('closes the card on Escape and puts focus back on the Menu button', async () => {
    useLoggedInUserStore.setState({ loggedInUser: _USER })
    const { user } = _renderAt('/cat')
    await _openMenu(user)

    await user.keyboard('{Escape}')

    expect(screen.queryByText('Hi, Ori!')).not.toBeInTheDocument()
    expect(_getMenuBtn()).toHaveFocus()
  })

  it('navigates and closes the card on a page click', async () => {
    useLoggedInUserStore.setState({ loggedInUser: _USER })
    const { router, user } = _renderAt('/cat')
    await _openMenu(user)

    await user.click(_getCard().getByRole('link', { name: 'About' }))

    expect(router.state.location.pathname).toBe('/about')
    expect(screen.queryByText('Hi, Ori!')).not.toBeInTheDocument()
  })

  it('closes the card on a click on the current page, with no route change', async () => {
    useLoggedInUserStore.setState({ loggedInUser: _USER })
    const { user } = _renderAt('/cat')
    await _openMenu(user)

    await user.click(_getCard().getByRole('link', { name: 'Cats' }))

    expect(screen.queryByText('Hi, Ori!')).not.toBeInTheDocument()
  })

  it('closes the card on a click outside it', async () => {
    useLoggedInUserStore.setState({ loggedInUser: _USER })
    const { user } = _renderAt('/cat')
    await _openMenu(user)

    await user.click(screen.getByText('Cats page'))

    expect(screen.queryByText('Hi, Ori!')).not.toBeInTheDocument()
  })

  it('closes the card on a route change', async () => {
    useLoggedInUserStore.setState({ loggedInUser: _USER })
    const { router, user } = _renderAt('/cat')
    await _openMenu(user)

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
    await _openMenu(user)

    act(() => onBreakpointChange())

    expect(screen.queryByText('Hi, Ori!')).not.toBeInTheDocument()
  })

  it('logs out from the card, clears the user and goes home', async () => {
    useLoggedInUserStore.setState({ loggedInUser: _USER })
    const { router, user } = _renderAt('/cat')
    await _openMenu(user)

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
    await _openMenu(user)

    await user.click(screen.getByRole('button', { name: 'Logout' }))

    expect(useLoggedInUserStore.getState().loggedInUser).toEqual(_USER)
    expect(useUserMsgStore.getState().msg).toMatchObject({
      txt: "Can't reach the server. Check your connection.",
      type: 'error',
    })
    expect(router.state.location.pathname).toBe('/cat')
    expect(_getMenuBtn()).toBeInTheDocument()
  })
})
