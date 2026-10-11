import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Cat, LoggedInUser, Review, ReviewWithRefs } from '@cat-store/shared'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RouteError } from '../../cmps/common/util/route-error'
import { ApiError } from '../../models/api-error'
import type { CatListLocationState } from '../../models/util'
import { catService } from '../../services/cat.service'
import { reviewService } from '../../services/review.service'
import { useLoggedInUserStore } from '../../store/logged-in-user.store'
import { useUserMsgStore } from '../../store/user-msg.store'
import { CatDetails } from './cat-details'
import { catDetailsAction } from './cat-details.action'
import { catDetailsLoader } from './cat-details.loader'
import { reviewAction } from '../review/review.action'

vi.mock('../../services/cat.service')
vi.mock('../../services/review.service')

const CAT = {
  _id: 'cat-1',
  ownerId: 'user-1',
  name: 'Mitzi',
  price: 95.5,
  labels: ['Calm', 'Indoor'],
  isInStock: false,
  imgUrl: '',
  createdAt: Date.UTC(2026, 9, 4, 12),
  updatedAt: Date.UTC(2026, 9, 4, 12),
} satisfies Cat

const CAT_OWNER: LoggedInUser = { _id: 'user-1', username: 'user', fullname: 'U', isAdmin: false }
const NON_CAT_OWNER_USER: LoggedInUser = { ...CAT_OWNER, _id: 'user-2' }
const ADMIN: LoggedInUser = { _id: 'admin-1', username: 'admin', fullname: 'A', isAdmin: true }

function _buildReview(_id: string, fullname: string, content: string): ReviewWithRefs {
  return {
    _id,
    content,
    createdAt: Date.UTC(2026, 9, 9, 12),
    updatedAt: Date.UTC(2026, 9, 9, 12),
    user: { _id: `${_id}-author`, fullname },
    cat: { _id: CAT._id, name: CAT.name, imgUrl: CAT.imgUrl },
  }
}

const REVIEWS = [
  _buildReview('review-1', 'Maya Levi', 'Such a sweet cat'),
  _buildReview('review-2', 'Noam Cohen', 'Calm and cuddly'),
]

function _renderAt(path: string, state?: CatListLocationState) {
  const router = createMemoryRouter(
    [
      // Like the app's root route: no fallback logs a warning while the first loader runs
      {
        HydrateFallback: () => null,
        children: [
          { path: '/cat', element: <p>Cat list</p> },
          {
            errorElement: <RouteError />,
            children: [
              {
                path: '/cat/:id',
                loader: catDetailsLoader,
                action: catDetailsAction,
                element: <CatDetails />,
              },
              // Like the app: a loader that 404s a typed-in visit. Fetchers must never run it
              {
                path: '/review',
                loader: () => {
                  throw new Error('the /review loader ran')
                },
                action: reviewAction,
              },
            ],
          },
        ],
      },
    ],
    { initialEntries: [{ pathname: path, state }] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('CatDetails', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(catService.getById).mockResolvedValue(CAT)
    vi.mocked(reviewService.query).mockResolvedValue([])
    // The owner, so Edit / Delete show - the cat rules have their own tests below
    useLoggedInUserStore.setState({ loggedInUser: CAT_OWNER })
  })

  it('shows the cat the loader got for the id', async () => {
    _renderAt('/cat/cat-1')

    expect(await screen.findByRole('heading', { name: 'Mitzi' })).toBeInTheDocument()
    expect(catService.getById).toHaveBeenCalledWith('cat-1')
    expect(screen.getByText('$95.50')).toBeInTheDocument()
    expect(screen.getByText('Sold out')).toBeInTheDocument()
    expect(screen.getByText('Calm')).toBeInTheDocument()
    expect(screen.getByText('Indoor')).toBeInTheDocument()
    expect(screen.getByText('Added Oct 4, 2026')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/cat/cat-1/edit')
  })

  it('goes back to the list with the filter it came from', async () => {
    _renderAt('/cat/cat-1', { listSearch: '?labels=Calm' })

    expect(await screen.findByRole('link', { name: '← Back to cats' })).toHaveAttribute(
      'href',
      '/cat?labels=Calm',
    )
  })

  it('goes back to the plain list on a direct visit', async () => {
    _renderAt('/cat/cat-1')

    expect(await screen.findByRole('link', { name: '← Back to cats' })).toHaveAttribute(
      'href',
      '/cat',
    )
  })

  it('does not delete when the confirm is cancelled', async () => {
    _renderAt('/cat/cat-1')
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))

    const dialog = screen.getByRole('dialog', { name: 'Delete Mitzi?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(catService.remove).not.toHaveBeenCalled()
  })

  it('deletes the cat after the confirm and lands on the list', async () => {
    vi.mocked(catService.remove).mockResolvedValue()
    const router = _renderAt('/cat/cat-1')
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))

    const dialog = screen.getByRole('dialog', { name: 'Delete Mitzi?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/cat'))
    expect(catService.remove).toHaveBeenCalledWith('cat-1')
    expect(screen.getByText('Cat list')).toBeInTheDocument()
  })

  it('stays on the page with an error message when the delete fails', async () => {
    const networkErr = new ApiError(0, 'NETWORK_ERROR', 'Network Error')
    vi.mocked(catService.remove).mockRejectedValue(networkErr)
    // the server is down, so a reload of the cat would fail too
    vi.mocked(catService.getById).mockResolvedValueOnce(CAT).mockRejectedValue(networkErr)
    _renderAt('/cat/cat-1')
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))

    const dialog = screen.getByRole('dialog', { name: 'Delete Mitzi?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByRole('button', { name: 'Delete' })).toBeEnabled()
    expect(screen.getByRole('heading', { name: 'Mitzi' })).toBeInTheDocument()
    expect(useUserMsgStore.getState().msg).toMatchObject({ type: 'error' })
    expect(catService.getById).toHaveBeenCalledOnce()
  })

  it('shows Edit and Delete to an admin who does not own the cat', async () => {
    useLoggedInUserStore.setState({ loggedInUser: ADMIN })
    _renderAt('/cat/cat-1')

    expect(await screen.findByRole('link', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it.each([
    ['a guest', null],
    ["a user who doesn't own the cat", NON_CAT_OWNER_USER],
  ])('hides Edit and Delete from %s', async (_, loggedInUser) => {
    useLoggedInUserStore.setState({ loggedInUser })
    _renderAt('/cat/cat-1')

    await screen.findByRole('heading', { name: 'Mitzi' })
    expect(screen.queryByRole('link', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument()
  })

  it("shows the not-found message for a cat that doesn't exist", async () => {
    vi.mocked(catService.getById).mockRejectedValue(
      new ApiError(404, 'CAT_NOT_FOUND', 'Cat not found'),
    )
    _renderAt('/cat/nope')

    expect(await screen.findByText("Cat doesn't exist (anymore).")).toBeInTheDocument()
  })
})

describe('CatDetails reviews', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(catService.getById).mockResolvedValue(CAT)
    vi.mocked(reviewService.query).mockResolvedValue(REVIEWS)
    useLoggedInUserStore.setState({ loggedInUser: NON_CAT_OWNER_USER })
    useUserMsgStore.setState({ msg: null, navigationMsg: null })
  })

  it("shows the cat's reviews with their author and date", async () => {
    _renderAt('/cat/cat-1')

    const section = await screen.findByRole('region', { name: 'Reviews' })
    const items = await within(section).findAllByRole('article')
    expect(items).toHaveLength(2)
    expect(within(items[0]).getByText('Maya Levi')).toBeInTheDocument()
    expect(within(items[0]).getByText('Such a sweet cat')).toBeInTheDocument()
    expect(within(items[0]).getByText('Oct 9, 2026')).toBeInTheDocument()
    expect(reviewService.query).toHaveBeenCalledWith({ catId: 'cat-1' })
  })

  it('says so when the cat has no reviews', async () => {
    vi.mocked(reviewService.query).mockResolvedValue([])
    _renderAt('/cat/cat-1')

    expect(await screen.findByText('No reviews yet')).toBeInTheDocument()
  })

  it('breaks only the reviews section when the reviews call fails', async () => {
    vi.mocked(reviewService.query).mockRejectedValue(
      new ApiError(0, 'NETWORK_ERROR', 'Network Error'),
    )
    _renderAt('/cat/cat-1')

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "Can't reach the server. Check your connection.",
    )
    expect(screen.getByRole('heading', { name: 'Mitzi' })).toBeInTheDocument()
    expect(screen.getByLabelText('Your review')).toBeInTheDocument()
  })

  it('shows a guest a login link back to this cat instead of the form', async () => {
    useLoggedInUserStore.setState({ loggedInUser: null })
    _renderAt('/cat/cat-1')

    expect(await screen.findByRole('link', { name: 'Log in' })).toHaveAttribute(
      'href',
      '/login?redirectTo=%2Fcat%2Fcat-1',
    )
    expect(screen.queryByLabelText('Your review')).not.toBeInTheDocument()
  })

  it('adds a review, clears the form and reloads the reviews', async () => {
    const added = _buildReview('review-3', 'non-owner', 'Purrfect')
    const saved: Review = {
      _id: added._id,
      userId: NON_CAT_OWNER_USER._id,
      catId: CAT._id,
      content: added.content,
      createdAt: added.createdAt,
      updatedAt: added.updatedAt,
    }
    vi.mocked(reviewService.add).mockResolvedValue(saved)
    _renderAt('/cat/cat-1')
    await screen.findByText('Such a sweet cat')
    vi.mocked(reviewService.query).mockResolvedValue([added, ...REVIEWS])

    await userEvent.type(screen.getByLabelText('Your review'), 'Purrfect')
    await userEvent.click(screen.getByRole('button', { name: 'Post review' }))

    expect(await screen.findByText('Purrfect')).toBeInTheDocument()
    expect(reviewService.add).toHaveBeenCalledWith({ catId: 'cat-1', content: 'Purrfect' })
    expect(screen.getByLabelText('Your review')).toHaveValue('')
    // A fresh form: the empty field doesn't show "Review is required" from the last submit
    expect(screen.queryByText('Review is required')).not.toBeInTheDocument()
    expect(useUserMsgStore.getState().msg).toMatchObject({ txt: 'Review added' })
  })

  it('keeps the typed text when the add fails', async () => {
    vi.mocked(reviewService.add).mockRejectedValue(
      new ApiError(0, 'NETWORK_ERROR', 'Network Error'),
    )
    _renderAt('/cat/cat-1')
    await screen.findByText('Such a sweet cat')

    await userEvent.type(screen.getByLabelText('Your review'), 'Purrfect')
    await userEvent.click(screen.getByRole('button', { name: 'Post review' }))

    await waitFor(() => expect(useUserMsgStore.getState().msg).toMatchObject({ type: 'error' }))
    expect(screen.getByRole('button', { name: 'Post review' })).toBeEnabled()
    expect(screen.getByLabelText('Your review')).toHaveValue('Purrfect')
    // An error status skips the reload
    expect(reviewService.query).toHaveBeenCalledOnce()
  })
})
