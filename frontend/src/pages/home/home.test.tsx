import { render, screen, within } from '@testing-library/react'
import type { Cat, CatLabelStats, LoggedInUser } from '@cat-store/shared'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../models/api-error'
import { catService } from '../../services/cat.service'
import { useLoggedInUserStore } from '../../store/logged-in-user.store'
import { Home } from './home'
import { homeLoader } from './home.loader'

vi.mock('../../services/cat.service')

const _USER = {
  _id: 'user-1',
  username: 'ori',
  fullname: 'Ori Sason',
  isAdmin: false,
} satisfies LoggedInUser

const _CAT = {
  _id: 'cat-1',
  ownerId: 'user-1',
  name: 'Mitzi',
  price: 95,
  labels: ['Calm'],
  isInStock: true,
  imgUrl: '',
  createdAt: 1,
  updatedAt: 1,
} satisfies Cat

const _STATS: CatLabelStats[] = [
  { label: 'Calm', count: 2, inStockCount: 1, medianPrice: 300, minPrice: 200, maxPrice: 400 },
  { label: 'Kitten', count: 0, inStockCount: 0, medianPrice: null, minPrice: null, maxPrice: null },
]

// Never settles: the lazy sections stay on their skeletons
function _pending() {
  return new Promise<never>(() => {})
}

// Resolves once the page has rendered - the hero is already there, and the router saw a pending promise
async function _render() {
  const router = createMemoryRouter([
    { path: '/', loader: homeLoader, element: <Home />, HydrateFallback: () => null },
  ])
  render(<RouterProvider router={router} />)
  await screen.findByRole('heading', { level: 1 })
}

function _getSection(name: string) {
  return screen.getByRole('heading', { name }).closest('section')!
}

// "Browse cats" is in the hero and in How it works, so look inside the hero
function _getHeroLink(name: string) {
  const hero = screen.getByRole('heading', { level: 1 }).closest('section')!
  return within(hero).getByRole('link', { name })
}

describe('Home', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(catService.query).mockReturnValue(_pending())
    vi.mocked(catService.getLabelStats).mockReturnValue(_pending())
  })

  afterEach(() => {
    useLoggedInUserStore.getState().clearLoggedInUser()
  })

  it('shows a guest the browse, login and signup links', async () => {
    await _render()

    expect(screen.getByText('Browse · Meet · Pick up')).toBeInTheDocument()
    expect(_getHeroLink('Browse cats')).toHaveAttribute('href', '/cat')
    // Login and signup come back to home, like the header's Login does
    const loginLinks = screen.getAllByRole('link', { name: 'Log in' })
    expect(loginLinks).toHaveLength(2) // hero + CTA card
    for (const link of loginLinks) expect(link).toHaveAttribute('href', '/login?redirectTo=%2F')
    expect(screen.getByRole('link', { name: 'Create an account' })).toHaveAttribute(
      'href',
      '/signup?redirectTo=%2F',
    )
    expect(screen.getByRole('link', { name: 'Sign up' })).toHaveAttribute(
      'href',
      '/signup?redirectTo=%2F',
    )
    expect(screen.getByRole('heading', { name: 'Got a cat to list?' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: '+ Add a cat' })).not.toBeInTheDocument()
  })

  it('greets a logged-in user by first name and offers Add a cat instead of login', async () => {
    useLoggedInUserStore.getState().setLoggedInUser(_USER)
    await _render()

    expect(screen.getByText('Welcome back, Ori')).toBeInTheDocument()
    expect(_getHeroLink('Browse cats')).toHaveAttribute('href', '/cat')
    const addLinks = screen.getAllByRole('link', { name: '+ Add a cat' })
    expect(addLinks).toHaveLength(2) // hero + CTA card
    for (const link of addLinks) expect(link).toHaveAttribute('href', '/cat/new')
    expect(screen.getByRole('heading', { name: 'Got a cat to list, Ori?' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Log in' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Create an account' })).not.toBeInTheDocument()
  })

  it('links every label chip to the list filtered by that label', async () => {
    await _render()

    expect(screen.getByRole('link', { name: 'Calm' })).toHaveAttribute('href', '/cat?labels=Calm')
    // Multi-word labels go through URLSearchParams encoding, the same as the filter bar
    expect(screen.getByRole('link', { name: 'Good with kids' })).toHaveAttribute(
      'href',
      '/cat?labels=Good+with+kids',
    )
    expect(
      screen.getAllByRole('listitem').filter((li) => li.querySelector('.label-chip')),
    ).toHaveLength(10)
  })

  // The arrows are decoration, so screen readers hear only the link text
  it('links the How it works steps, with the arrows hidden from screen readers', async () => {
    await _render()

    const steps = screen.getByRole('heading', { name: 'How it works' }).closest('section')!
    expect(within(steps).getByRole('link', { name: 'Browse cats' })).toHaveAttribute('href', '/cat')
    expect(within(steps).getByRole('link', { name: 'See pickup points' })).toHaveAttribute(
      'href',
      '/about',
    )
  })

  it('tags the Meet step as Soon, with no link', async () => {
    await _render()

    const meet = screen.getByRole('heading', { name: 'Meet Soon' }).closest('li')!
    expect(meet.querySelector('a')).toBeNull()
  })

  it('renders the hero right away, with skeletons while the cats and prices load', async () => {
    await _render()

    expect(screen.getByRole('link', { name: 'Create an account' })).toBeInTheDocument()
    expect(within(_getSection('Newest cats')).getByLabelText('Loading cats')).toBeInTheDocument()
    expect(
      within(_getSection('Median price by label')).getByLabelText('Loading prices'),
    ).toBeInTheDocument()
  })

  it('shows the newest cats and the price bars once they load', async () => {
    vi.mocked(catService.query).mockResolvedValue([_CAT])
    vi.mocked(catService.getLabelStats).mockResolvedValue(_STATS)
    await _render()

    const cats = _getSection('Newest cats')
    expect(await within(cats).findByRole('link', { name: /Mitzi/ })).toHaveAttribute(
      'href',
      '/cat/cat-1',
    )
    const prices = _getSection('Median price by label')
    const bars = await within(prices).findAllByRole('listitem')
    expect(bars).toHaveLength(1) // Kitten has no median
    expect(bars[0]).toHaveTextContent('Calm$300')
  })

  it('shows an error in the failed section only, and keeps the rest of the page', async () => {
    vi.mocked(catService.query).mockResolvedValue([_CAT])
    // Created on call, inside the loader, so it's never an unhandled rejection
    vi.mocked(catService.getLabelStats).mockImplementation(() =>
      Promise.reject(new ApiError(0, 'NETWORK_ERROR', 'Network Error')),
    )
    await _render()

    const prices = _getSection('Median price by label')
    expect(await within(prices).findByRole('alert')).toHaveTextContent(
      "Can't reach the server. Check your connection.",
    )
    expect(
      await within(_getSection('Newest cats')).findByRole('link', { name: /Mitzi/ }),
    ).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument()
  })

  it('says so when no cats are listed yet', async () => {
    vi.mocked(catService.query).mockResolvedValue([])
    await _render()

    expect(
      await within(_getSection('Newest cats')).findByText('No cats listed yet'),
    ).toBeInTheDocument()
  })
})
