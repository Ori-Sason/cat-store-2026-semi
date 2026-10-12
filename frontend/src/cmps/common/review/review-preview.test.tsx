import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { LoggedInUser, Review, ReviewWithRefs } from '@cat-store/shared'
import { createMemoryRouter, RouterProvider, useLoaderData } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../models/api-error'
import { reviewAction } from '../../../pages/review/review.action'
import { reviewService } from '../../../services/review.service'
import { useLoggedInUserStore } from '../../../store/logged-in-user.store'
import { useUserMsgStore } from '../../../store/user-msg.store'
import { ReviewList } from './review-list'
import type { ReviewShownOn } from './review-preview'

vi.mock('../../../services/review.service')

const AUTHOR: LoggedInUser = { _id: 'user-1', username: 'maya', fullname: 'Maya', isAdmin: false }
const OTHER_USER: LoggedInUser = { ...AUTHOR, _id: 'user-2', username: 'noam' }
const CAT_OWNER: LoggedInUser = { ...AUTHOR, _id: 'owner-1', username: 'dana' }
const ADMIN: LoggedInUser = { _id: 'admin-1', username: 'admin', fullname: 'A', isAdmin: true }

const REVIEW: ReviewWithRefs = {
  _id: 'review-1',
  content: 'Such a sweet cat',
  createdAt: Date.UTC(2026, 9, 9, 12),
  updatedAt: Date.UTC(2026, 9, 9, 12),
  user: { _id: AUTHOR._id, fullname: 'Maya Levi', isAdmin: false },
  cat: { _id: 'cat-1', name: 'Mitzi', imgUrl: '', ownerId: CAT_OWNER._id },
}

const STORED: Review = {
  _id: REVIEW._id,
  catId: REVIEW.cat._id,
  userId: AUTHOR._id,
  content: 'Even sweeter',
  createdAt: REVIEW.createdAt,
  updatedAt: REVIEW.updatedAt + 1,
}

// A test-only page, not a `_` helper: hooks lint needs a PascalCase component name
function ReviewsPage({ shownOn }: { shownOn?: ReviewShownOn }) {
  return <ReviewList reviews={useLoaderData<ReviewWithRefs[]>()} shownOn={shownOn} />
}

// A page whose loader reads the reviews, plus the real action-only /review/:id route.
// After an action, react-router reloads this page's loader, like on cat-details
function _render(loggedInUser: LoggedInUser | null, shownOn?: ReviewShownOn) {
  useLoggedInUserStore.setState({ loggedInUser })
  const router = createMemoryRouter(
    [
      {
        HydrateFallback: () => null,
        children: [
          {
            path: '/',
            loader: () => reviewService.query({ catId: 'cat-1' }),
            element: <ReviewsPage shownOn={shownOn} />,
          },
          { path: '/review/:id', action: reviewAction },
        ],
      },
    ],
    { initialEntries: ['/'] },
  )
  render(<RouterProvider router={router} />)
}

async function _findReview() {
  return screen.findByRole('article')
}

// Opens the ⋮ menu, then picks an option (test-setup emulates the popover)
async function _choose(review: HTMLElement, option: 'Edit' | 'Delete') {
  await userEvent.click(within(review).getByRole('button', { name: 'Review actions' }))
  await userEvent.click(within(review).getByRole('button', { name: option }))
}

describe('ReviewPreview', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useUserMsgStore.setState({ msg: null, navigationMsg: null })
    vi.mocked(reviewService.query).mockResolvedValue([REVIEW])
  })

  describe('who sees the actions menu', () => {
    it.each([
      ['the author', AUTHOR],
      ['an admin', ADMIN],
    ])('shows them to %s', async (_, user) => {
      _render(user)
      const review = await _findReview()

      expect(within(review).getByRole('button', { name: 'Review actions' })).toBeInTheDocument()
    })

    it.each([
      ['another user', OTHER_USER],
      ['a guest', null],
    ])('hides them from %s', async (_, user) => {
      _render(user)
      const review = await _findReview()

      expect(within(review).queryByRole('button')).not.toBeInTheDocument()
    })
  })

  describe('the You chip', () => {
    it("marks the viewer's own review", async () => {
      _render(AUTHOR)
      const review = await _findReview()

      expect(within(review).getByText('You')).toBeInTheDocument()
    })

    it.each([
      ['an admin', ADMIN],
      ['another user', OTHER_USER],
      ['a guest', null],
    ])('is not on the review for %s', async (_, user) => {
      _render(user)
      const review = await _findReview()

      expect(within(review).queryByText('You')).not.toBeInTheDocument()
    })
  })

  // isAdmin comes with the review's author ref, so everyone sees it
  describe('the Admin chip', () => {
    it('marks a review by an admin, for everyone', async () => {
      vi.mocked(reviewService.query).mockResolvedValue([
        { ...REVIEW, user: { _id: ADMIN._id, fullname: 'Admin User', isAdmin: true } },
      ])
      _render(null)
      const review = await _findReview()

      expect(within(review).getByText('Admin')).toBeInTheDocument()
    })

    it('is not on a review by a regular user', async () => {
      _render(ADMIN)
      const review = await _findReview()

      expect(within(review).queryByText('Admin')).not.toBeInTheDocument()
    })

    // The user page's header marks the admin once instead
    it("is not on a review row on a user's page", async () => {
      vi.mocked(reviewService.query).mockResolvedValue([
        { ...REVIEW, user: { _id: ADMIN._id, fullname: 'Admin User', isAdmin: true } },
      ])
      _render(null, 'user')
      const review = await _findReview()

      expect(within(review).queryByText('Admin')).not.toBeInTheDocument()
    })
  })

  describe('the Owner chip', () => {
    it("marks a review by the cat's owner, for everyone", async () => {
      vi.mocked(reviewService.query).mockResolvedValue([
        { ...REVIEW, user: { _id: CAT_OWNER._id, fullname: 'Dana Katz', isAdmin: false } },
      ])
      _render(null)
      const review = await _findReview()

      expect(within(review).getByText('Owner')).toBeInTheDocument()
    })

    it('shows both chips when the owner views their own review', async () => {
      vi.mocked(reviewService.query).mockResolvedValue([
        { ...REVIEW, user: { _id: CAT_OWNER._id, fullname: 'Dana Katz', isAdmin: false } },
      ])
      _render(CAT_OWNER)
      const review = await _findReview()

      expect(within(review).getByText('Owner')).toBeInTheDocument()
      expect(within(review).getByText('You')).toBeInTheDocument()
    })

    it('is not on a review by someone else, even when the owner views it', async () => {
      _render(CAT_OWNER)
      const review = await _findReview()

      expect(within(review).queryByText('Owner')).not.toBeInTheDocument()
    })
  })

  it("names the author, not the cat, on a cat's page", async () => {
    _render(null)
    const review = await _findReview()

    expect(within(review).getByText('Maya Levi')).toBeInTheDocument()
    expect(within(review).queryByRole('link')).not.toBeInTheDocument()
  })

  // On a user's page the row names the cat, not the author
  describe('on a user page', () => {
    it('shows the cat as a link to its page, not the author', async () => {
      _render(null, 'user')
      const review = await _findReview()

      expect(within(review).getByText('On')).toBeInTheDocument()
      expect(within(review).getByRole('link', { name: 'Mitzi' })).toHaveAttribute(
        'href',
        '/cat/cat-1',
      )
      expect(within(review).queryByText('Maya Levi')).not.toBeInTheDocument()
    })

    it("leaves out the You chip on the viewer's own review", async () => {
      _render(AUTHOR, 'user')
      const review = await _findReview()

      expect(within(review).queryByText('You')).not.toBeInTheDocument()
      // Still editable: only the header differs
      expect(within(review).getByRole('button', { name: 'Review actions' })).toBeInTheDocument()
    })

    it('keeps the Owner chip on a review of their own cat', async () => {
      vi.mocked(reviewService.query).mockResolvedValue([
        { ...REVIEW, user: { _id: CAT_OWNER._id, fullname: 'Dana Katz', isAdmin: false } },
      ])
      _render(CAT_OWNER, 'user')
      const review = await _findReview()

      expect(within(review).getByText('Owner')).toBeInTheDocument()
    })
  })

  describe('edit', () => {
    it('opens the form prefilled and cancels back to the text', async () => {
      _render(AUTHOR)
      const review = await _findReview()

      await _choose(review, 'Edit')
      expect(within(review).getByLabelText('Edit your review')).toHaveValue('Such a sweet cat')
      // The menu unmounts, so focus moves to the form instead of dropping to <body>
      expect(within(review).getByLabelText('Edit your review')).toHaveFocus()
      expect(
        within(review).queryByRole('button', { name: 'Review actions' }),
      ).not.toBeInTheDocument()

      await userEvent.click(within(review).getByRole('button', { name: 'Cancel' }))
      expect(within(review).queryByRole('textbox')).not.toBeInTheDocument()
      expect(within(review).getByRole('button', { name: 'Review actions' })).toBeInTheDocument()
      expect(within(review).getByText('Such a sweet cat')).toBeInTheDocument()
      expect(reviewService.update).not.toHaveBeenCalled()
    })

    it('saves, closes the form and shows the reloaded text', async () => {
      vi.mocked(reviewService.update).mockResolvedValue(STORED)
      _render(AUTHOR)
      const review = await _findReview()

      await _choose(review, 'Edit')
      const field = within(review).getByLabelText('Edit your review')
      await userEvent.clear(field)
      await userEvent.type(field, 'Even sweeter')
      // The reload after the action returns the edited review
      vi.mocked(reviewService.query).mockResolvedValue([{ ...REVIEW, content: 'Even sweeter' }])
      await userEvent.click(within(review).getByRole('button', { name: 'Save' }))

      // The review's text, not the edit form's textarea, which also holds it until the form closes
      expect(await within(review).findByText('Even sweeter', { selector: 'p' })).toBeInTheDocument()
      expect(within(review).queryByRole('textbox')).not.toBeInTheDocument()
      expect(reviewService.update).toHaveBeenCalledWith('review-1', { content: 'Even sweeter' })
      expect(useUserMsgStore.getState().msg).toMatchObject({ txt: 'Review updated' })
    })

    it('keeps the form open with the typed text when the save fails', async () => {
      vi.mocked(reviewService.update).mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Forbidden'))
      _render(AUTHOR)
      const review = await _findReview()

      await _choose(review, 'Edit')
      const field = within(review).getByLabelText('Edit your review')
      await userEvent.type(field, '!')
      await userEvent.click(within(review).getByRole('button', { name: 'Save' }))

      await waitFor(() => expect(useUserMsgStore.getState().msg).toMatchObject({ type: 'error' }))
      expect(within(review).getByRole('button', { name: 'Save' })).toBeEnabled()
      expect(field).toHaveValue('Such a sweet cat!')
      // An error status skips the reload
      expect(reviewService.query).toHaveBeenCalledOnce()
    })
  })

  describe('delete', () => {
    it('does not delete when the confirm is cancelled', async () => {
      _render(AUTHOR)
      const review = await _findReview()

      await _choose(review, 'Delete')
      const dialog = screen.getByRole('dialog', { name: 'Delete this review?' })
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(reviewService.remove).not.toHaveBeenCalled()
    })

    it('deletes after the confirm and reloads the list', async () => {
      vi.mocked(reviewService.remove).mockResolvedValue()
      _render(ADMIN)
      const review = await _findReview()

      await _choose(review, 'Delete')
      vi.mocked(reviewService.query).mockResolvedValue([])
      const dialog = screen.getByRole('dialog', { name: 'Delete this review?' })
      await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

      expect(await screen.findByText('No reviews yet')).toBeInTheDocument()
      expect(reviewService.remove).toHaveBeenCalledWith('review-1')
      expect(useUserMsgStore.getState().msg).toMatchObject({ txt: 'Review deleted' })
    })

    it('keeps the review with an error message when the delete fails', async () => {
      vi.mocked(reviewService.remove).mockRejectedValue(
        new ApiError(404, 'REVIEW_NOT_FOUND', 'Review not found'),
      )
      _render(AUTHOR)
      const review = await _findReview()

      await _choose(review, 'Delete')
      const dialog = screen.getByRole('dialog', { name: 'Delete this review?' })
      await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

      await waitFor(() => expect(useUserMsgStore.getState().msg).toMatchObject({ type: 'error' }))
      expect(within(review).getByRole('button', { name: 'Review actions' })).toBeEnabled()
      expect(within(review).getByText('Such a sweet cat')).toBeInTheDocument()
    })
  })
})
