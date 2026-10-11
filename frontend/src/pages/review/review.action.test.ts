import type { Review } from '@cat-store/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../models/api-error'
import { reviewService } from '../../services/review.service'
import { useUserMsgStore } from '../../store/user-msg.store'
import { reviewAction } from './review.action'

vi.mock('../../services/review.service')

const _INPUT = { catId: 'cat-1', content: 'Such a sweet cat' }

function _request(method: string, body?: unknown, path = '/review') {
  return new Request(`http://localhost${path}`, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

const store = () => useUserMsgStore.getState()

describe('reviewAction', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useUserMsgStore.setState({ msg: null, navigationMsg: null })
  })

  describe('POST', () => {
    it('adds the review, shows a message and returns the new review', async () => {
      const saved: Review = {
        ..._INPUT,
        _id: 'review-1',
        userId: 'user-1',
        createdAt: 1,
        updatedAt: 1,
      }
      vi.mocked(reviewService.add).mockResolvedValue(saved)

      const result = await reviewAction({ request: _request('POST', _INPUT), params: {} })

      expect(reviewService.add).toHaveBeenCalledWith(_INPUT)
      expect(result).toEqual({ review: saved })
      expect(store().msg).toMatchObject({ txt: 'Review added', type: 'success' })
    })

    it('shows the error and returns an error status when the add fails', async () => {
      vi.mocked(reviewService.add).mockRejectedValue(
        new ApiError(404, 'CAT_NOT_FOUND', 'Cat not found'),
      )

      const result = await reviewAction({ request: _request('POST', _INPUT), params: {} })

      expect(result).toMatchObject({ data: null, init: { status: 404 } })
      expect(store().msg).toMatchObject({ txt: "Cat doesn't exist (anymore).", type: 'error' })
    })
  })

  describe('PUT', () => {
    it('updates the review by its route id, shows a message and returns it', async () => {
      const saved: Review = {
        ..._INPUT,
        _id: 'review-1',
        userId: 'user-1',
        content: 'Even sweeter',
        createdAt: 1,
        updatedAt: 2,
      }
      vi.mocked(reviewService.update).mockResolvedValue(saved)

      const result = await reviewAction({
        request: _request('PUT', { content: 'Even sweeter' }, '/review/review-1'),
        params: { id: 'review-1' },
      })

      expect(reviewService.update).toHaveBeenCalledWith('review-1', { content: 'Even sweeter' })
      expect(result).toEqual({ review: saved })
      expect(store().msg).toMatchObject({ txt: 'Review updated', type: 'success' })
    })

    it('shows the error and returns an error status when the update fails', async () => {
      vi.mocked(reviewService.update).mockRejectedValue(new ApiError(403, 'FORBIDDEN', 'Forbidden'))

      const result = await reviewAction({
        request: _request('PUT', { content: 'Even sweeter' }, '/review/review-1'),
        params: { id: 'review-1' },
      })

      expect(result).toMatchObject({ data: null, init: { status: 403 } })
      expect(store().msg).toMatchObject({ type: 'error' })
    })
  })

  describe('DELETE', () => {
    it('removes the review by its route id and shows a message', async () => {
      vi.mocked(reviewService.remove).mockResolvedValue()

      const result = await reviewAction({
        request: _request('DELETE', undefined, '/review/review-1'),
        params: { id: 'review-1' },
      })

      expect(reviewService.remove).toHaveBeenCalledWith('review-1')
      expect(result).toBeNull()
      expect(store().msg).toMatchObject({ txt: 'Review deleted', type: 'success' })
    })

    it('shows the error and returns an error status when the delete fails', async () => {
      vi.mocked(reviewService.remove).mockRejectedValue(
        new ApiError(404, 'REVIEW_NOT_FOUND', 'Review not found'),
      )

      const result = await reviewAction({
        request: _request('DELETE', undefined, '/review/review-1'),
        params: { id: 'review-1' },
      })

      expect(result).toMatchObject({ data: null, init: { status: 404 } })
      expect(store().msg).toMatchObject({ type: 'error' })
    })
  })

  it('returns 405 for a method it does not handle, without calling the API', async () => {
    const result = await reviewAction({ request: _request('PATCH', _INPUT), params: {} })

    expect(result).toMatchObject({ data: null, init: { status: 405 } })
    expect(reviewService.add).not.toHaveBeenCalled()
  })
})
