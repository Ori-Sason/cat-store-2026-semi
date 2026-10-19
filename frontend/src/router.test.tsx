import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { CatWithRefs, LoggedInUser, Review, ReviewWithRefs } from '@cat-store/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from './router'
import { catService } from './services/cat.service'
import { reviewService } from './services/review.service'
import { userService } from './services/user.service'
import { useLoggedInUserStore } from './store/logged-in-user.store'

vi.mock('./services/cat.service')
vi.mock('./services/review.service')
vi.mock('./services/user.service')

// The real route config, for what lives only there
function _renderAt(path: string) {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />)
}

describe('routes', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    // react-router logs every caught route error - keep test output clean
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    useLoggedInUserStore.setState({ loggedInUser: null })
  })

  it.each(['/review', '/review/review-1', '/no-such-page'])(
    'shows "Page not found" for a visit to %s',
    async (path) => {
      _renderAt(path)

      expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    },
  )

  // The reviews section is a child route of /cat/:id with its own loader
  it("renders the cat's reviews section from its child route", async () => {
    vi.mocked(catService.getById).mockResolvedValue({
      _id: 'cat-1',
      name: 'Mitzi',
      labels: [],
      owner: { _id: 'user-2', fullname: 'O', isAdmin: false },
    } as unknown as CatWithRefs)
    vi.mocked(reviewService.query).mockResolvedValue([])
    _renderAt('/cat/cat-1')

    expect(await screen.findByText('No reviews yet')).toBeInTheDocument()
    expect(reviewService.query).toHaveBeenCalledWith({ catId: 'cat-1' })
  })

  // The refetch split lives in this config (the parent's shouldRevalidate + the reviews child),
  // so pin it here too: page tests build their own route tree and can't catch it going missing
  it('reloads only the reviews after adding one, not the cat', async () => {
    const user: LoggedInUser = { _id: 'user-1', username: 'user', fullname: 'U', isAdmin: false }
    useLoggedInUserStore.setState({ loggedInUser: user })
    vi.mocked(catService.getById).mockResolvedValue({
      _id: 'cat-1',
      name: 'Mitzi',
      labels: [],
      owner: { _id: 'user-2', fullname: 'O', isAdmin: false },
    } as unknown as CatWithRefs)
    vi.mocked(reviewService.query).mockResolvedValue([])
    vi.mocked(reviewService.add).mockResolvedValue({ _id: 'review-1' } as Review)
    _renderAt('/cat/cat-1')
    await screen.findByText('No reviews yet')
    vi.mocked(reviewService.query).mockResolvedValue([
      {
        _id: 'review-1',
        content: 'Purrfect',
        createdAt: Date.UTC(2026, 9, 9),
        updatedAt: Date.UTC(2026, 9, 9),
        user: { _id: user._id, fullname: user.fullname, isAdmin: false },
        cat: { _id: 'cat-1', name: 'Mitzi', imgUrl: '', ownerId: 'user-2' },
      } satisfies ReviewWithRefs,
    ])

    await userEvent.type(screen.getByLabelText('Your review'), 'Purrfect')
    await userEvent.click(screen.getByRole('button', { name: 'Post review' }))

    // The review's text, not the add form's textarea, which also holds it until the form remounts
    expect(await screen.findByText('Purrfect', { selector: 'p' })).toBeInTheDocument()
    expect(reviewService.query).toHaveBeenCalledTimes(2)
    expect(catService.getById).toHaveBeenCalledOnce()
  })

  // The same split on the user page: its reviews tab reloads alone after a review action
  it("reloads only the user's reviews after deleting one, not the user", async () => {
    const user: LoggedInUser = { _id: 'user-1', username: 'user', fullname: 'U', isAdmin: false }
    useLoggedInUserStore.setState({ loggedInUser: user })
    vi.mocked(userService.getById).mockResolvedValue({
      _id: user._id,
      fullname: user.fullname,
      isAdmin: false,
      createdAt: Date.UTC(2026, 9, 4),
    })
    vi.mocked(reviewService.query).mockResolvedValue([
      {
        _id: 'review-1',
        content: 'Purrfect',
        createdAt: Date.UTC(2026, 9, 9),
        updatedAt: Date.UTC(2026, 9, 9),
        user: { _id: user._id, fullname: user.fullname, isAdmin: false },
        cat: { _id: 'cat-1', name: 'Mitzi', imgUrl: '', ownerId: 'user-2' },
      } satisfies ReviewWithRefs,
    ])
    vi.mocked(reviewService.remove).mockResolvedValue()
    _renderAt('/user/user-1/reviews')
    const review = await screen.findByRole('article')
    vi.mocked(reviewService.query).mockResolvedValue([])

    await userEvent.click(within(review).getByRole('button', { name: 'Review actions' }))
    await userEvent.click(within(review).getByRole('button', { name: 'Delete' }))
    const dialog = screen.getByRole('alertdialog', { name: 'Delete this review?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByText('No reviews yet')).toBeInTheDocument()
    expect(reviewService.query).toHaveBeenCalledTimes(2)
    expect(userService.getById).toHaveBeenCalledOnce()
  })
})
