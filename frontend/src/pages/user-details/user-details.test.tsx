import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Cat, LoggedInUser, PublicUser, ReviewWithRefs } from '@cat-store/shared'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UserCats } from '../../cmps/user-details/user-cats'
import { UserReviews } from '../../cmps/user-details/user-reviews'
import { RouteError } from '../../cmps/common/util/route-error'
import { ApiError } from '../../models/api-error'
import { catService } from '../../services/cat.service'
import { reviewService } from '../../services/review.service'
import { userService } from '../../services/user.service'
import { utilService } from '../../services/util.service'
import { useLoggedInUserStore } from '../../store/logged-in-user.store'
import { reviewAction } from '../review/review.action'
import { reviewLoader } from '../review/review.loader'
import { userCatsLoader } from './user-cats.loader'
import { UserDetails } from './user-details'
import { userDetailsLoader } from './user-details.loader'

vi.mock('../../services/user.service')
vi.mock('../../services/cat.service')
vi.mock('../../services/review.service')

function _buildUser(_id: string, fullname: string): PublicUser {
  return { _id, fullname, isAdmin: false, createdAt: Date.UTC(2026, 9, 4, 12) }
}

function _buildCat(_id: string, name: string, ownerId: string): Cat {
  return {
    _id,
    ownerId,
    name,
    price: 100,
    labels: [],
    isInStock: true,
    imgUrl: '',
    createdAt: 1,
    updatedAt: 1,
  }
}

const MAYA = _buildUser('user-1', 'Maya Levi')
const NOAM = _buildUser('user-2', 'Noam Cohen')
const MAYA_CAT = _buildCat('cat-1', 'Mitzi', MAYA._id)
const MAYA_LOGGED_IN: LoggedInUser = { ...MAYA, username: 'maya' }

// Maya's review of someone else's cat
const MAYA_REVIEW: ReviewWithRefs = {
  _id: 'review-1',
  content: 'Such a sweet cat',
  createdAt: Date.UTC(2026, 9, 9, 12),
  updatedAt: Date.UTC(2026, 9, 9, 12),
  user: { _id: MAYA._id, fullname: MAYA.fullname },
  cat: { _id: 'cat-2', name: 'Luna', imgUrl: '', ownerId: NOAM._id },
}

// Like the app's route: each tab is a child route with its own loader. Plus the action-only
// /review/:id route the review rows post to
function _renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        // Like the app's root route: no fallback logs a warning while the first loader runs
        HydrateFallback: () => null,
        errorElement: <RouteError />,
        children: [
          {
            path: '/user/:id',
            loader: userDetailsLoader,
            shouldRevalidate: utilService.skipReloadOnActionAt('/review'),
            element: <UserDetails />,
            children: [
              { index: true, loader: userCatsLoader, element: <UserCats /> },
              {
                path: 'reviews',
                loader: (args) => reviewLoader(args, 'userId'),
                element: <UserReviews />,
              },
            ],
          },
          { path: '/review/:id', action: reviewAction },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('UserDetails', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(userService.getById).mockImplementation(async (userId) =>
      userId === NOAM._id ? NOAM : MAYA,
    )
    vi.mocked(catService.query).mockResolvedValue([MAYA_CAT])
    vi.mocked(reviewService.query).mockResolvedValue([MAYA_REVIEW])
  })

  afterEach(() => {
    useLoggedInUserStore.setState({ loggedInUser: null })
  })

  it("shows the user's header and their cats on the cats tab", async () => {
    _renderAt('/user/user-1')

    expect(await screen.findByRole('heading', { name: 'Maya Levi' })).toBeInTheDocument()
    expect(screen.getByText('Joined Oct 4, 2026')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Mitzi' })).toBeInTheDocument()
    expect(userService.getById).toHaveBeenCalledWith('user-1')
    expect(catService.query).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 'user-1' }))
  })

  it('marks an admin with an Admin chip in the header', async () => {
    vi.mocked(userService.getById).mockResolvedValue({ ...MAYA, isAdmin: true })
    _renderAt('/user/user-1')

    const header = (await screen.findByRole('heading', { name: 'Maya Levi' })).closest('header')!
    expect(within(header).getByText('Admin')).toBeInTheDocument()
  })

  it('shows no Admin chip for a regular user', async () => {
    _renderAt('/user/user-1')

    await screen.findByRole('heading', { name: 'Maya Levi' })
    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
  })

  it('marks the cats tab as the current page', async () => {
    _renderAt('/user/user-1')

    const tabs = await screen.findByRole('navigation', { name: 'User sections' })
    expect(within(tabs).getByRole('link', { name: 'Cats' })).toHaveAttribute('aria-current', 'page')
  })

  it('says so when the user has no cats', async () => {
    vi.mocked(catService.query).mockResolvedValue([])
    _renderAt('/user/user-1')

    expect(await screen.findByText('No cats listed yet.')).toBeInTheDocument()
  })

  // The tab's loader is deferred, so its failure stays in the tab's <Await>
  it('keeps the header when the cats request fails', async () => {
    vi.mocked(catService.query).mockRejectedValue(new ApiError(500, 'INTERNAL', 'boom'))
    _renderAt('/user/user-1')

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong')
    expect(screen.getByRole('heading', { name: 'Maya Levi' })).toBeInTheDocument()
  })

  it('shows the route error for a user that does not exist', async () => {
    vi.mocked(userService.getById).mockRejectedValue(
      new ApiError(404, 'USER_NOT_FOUND', 'User not found'),
    )
    _renderAt('/user/nope')

    expect(await screen.findByText("User doesn't exist (anymore).")).toBeInTheDocument()
  })

  // Without the key on the tab's <Suspense>, Maya's cats would stay under Noam's header
  // until Noam's arrived
  it("shows the skeleton, not the last user's cats, while another user's cats load", async () => {
    const router = _renderAt('/user/user-1')
    expect(await screen.findByRole('heading', { name: 'Mitzi' })).toBeInTheDocument()

    vi.mocked(catService.query).mockReturnValue(new Promise<never>(() => {}))
    await router.navigate('/user/user-2')

    expect(await screen.findByRole('heading', { name: 'Noam Cohen' })).toBeInTheDocument()
    expect(screen.getByLabelText('Loading cats')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Mitzi' })).not.toBeInTheDocument()
  })

  describe('the reviews tab', () => {
    it("shows the user's reviews, each with its cat", async () => {
      _renderAt('/user/user-1/reviews')

      const review = await screen.findByRole('article')
      expect(within(review).getByRole('link', { name: 'Luna' })).toHaveAttribute(
        'href',
        '/cat/cat-2',
      )
      expect(within(review).getByText('Such a sweet cat')).toBeInTheDocument()
      expect(reviewService.query).toHaveBeenCalledWith({ userId: 'user-1' })
      expect(catService.query).not.toHaveBeenCalled()
    })

    it('marks the reviews tab as the current page, and only it', async () => {
      _renderAt('/user/user-1/reviews')

      const tabs = await screen.findByRole('navigation', { name: 'User sections' })
      expect(within(tabs).getByRole('link', { name: 'Reviews' })).toHaveAttribute(
        'aria-current',
        'page',
      )
      expect(within(tabs).getByRole('link', { name: 'Cats' })).not.toHaveAttribute('aria-current')
    })

    // A tab switch keeps the parent's match (/user/:id), so only the new tab's loader runs
    it('loads the user once across a tab switch', async () => {
      _renderAt('/user/user-1')
      await screen.findByRole('heading', { name: 'Mitzi' })

      await userEvent.click(screen.getByRole('link', { name: 'Reviews' }))

      expect(await screen.findByRole('link', { name: 'Luna' })).toBeInTheDocument()
      expect(userService.getById).toHaveBeenCalledOnce()
    })

    it('keeps the header when the reviews request fails', async () => {
      vi.mocked(reviewService.query).mockRejectedValue(new ApiError(500, 'INTERNAL', 'boom'))
      _renderAt('/user/user-1/reviews')

      expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong')
      expect(screen.getByRole('heading', { name: 'Maya Levi' })).toBeInTheDocument()
    })

    // The parent's shouldRevalidate skips actions at /review: the edit reloads only the tab
    it('reloads only the reviews after an edit, not the user', async () => {
      useLoggedInUserStore.setState({ loggedInUser: MAYA_LOGGED_IN })
      vi.mocked(reviewService.update).mockResolvedValue({
        _id: MAYA_REVIEW._id,
        catId: MAYA_REVIEW.cat._id,
        userId: MAYA._id,
        content: 'Even sweeter',
        createdAt: MAYA_REVIEW.createdAt,
        updatedAt: MAYA_REVIEW.updatedAt + 1,
      })
      _renderAt('/user/user-1/reviews')
      const review = await screen.findByRole('article')

      await userEvent.click(within(review).getByRole('button', { name: 'Review actions' }))
      await userEvent.click(within(review).getByRole('button', { name: 'Edit' }))
      const field = within(review).getByLabelText('Edit your review')
      await userEvent.clear(field)
      await userEvent.type(field, 'Even sweeter')
      vi.mocked(reviewService.query).mockResolvedValue([
        { ...MAYA_REVIEW, content: 'Even sweeter' },
      ])
      await userEvent.click(within(review).getByRole('button', { name: 'Save' }))

      // The review's text, not the edit form's textarea, which also holds it until the form closes
      expect(await screen.findByText('Even sweeter', { selector: 'p' })).toBeInTheDocument()
      expect(reviewService.query).toHaveBeenCalledTimes(2)
      expect(userService.getById).toHaveBeenCalledOnce()
    })

    it("shows the skeleton, not the last user's reviews, while another user's reviews load", async () => {
      const router = _renderAt('/user/user-1/reviews')
      expect(await screen.findByRole('link', { name: 'Luna' })).toBeInTheDocument()

      vi.mocked(reviewService.query).mockReturnValue(new Promise<never>(() => {}))
      await router.navigate('/user/user-2/reviews')

      expect(await screen.findByRole('heading', { name: 'Noam Cohen' })).toBeInTheDocument()
      expect(screen.getByLabelText('Loading reviews')).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'Luna' })).not.toBeInTheDocument()
    })
  })
})
