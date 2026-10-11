import Axios from 'axios'
import type { ReviewWithRefs } from '@cat-store/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../models/api-error'
import { httpService } from './http.service'
import { reviewService } from './review.service'

vi.mock('./http.service')

const _ENDPOINT = 'reviews'

const _REVIEW: ReviewWithRefs = {
  _id: 'review-1',
  content: 'Sweet and calm',
  createdAt: 1,
  updatedAt: 1,
  user: { _id: 'user-1', fullname: 'Maya Levi' },
  cat: { _id: 'cat-1', name: 'Mitzi', imgUrl: '' },
}

describe('reviewService', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('query', () => {
    it('returns the reviews from the API', async () => {
      vi.mocked(httpService.get).mockResolvedValue([_REVIEW])

      expect(await reviewService.query({ catId: 'cat-1' })).toEqual([_REVIEW])
      expect(httpService.get).toHaveBeenCalledWith(_ENDPOINT, { catId: 'cat-1' })
    })

    it('reaches the wire as plain query params', async () => {
      await reviewService.query({ catId: 'cat-1', userId: 'user-1' })
      const params = vi.mocked(httpService.get).mock.lastCall?.[1]

      expect(Axios.getUri({ url: `/api/${_ENDPOINT}`, params })).toBe(
        `/api/${_ENDPOINT}?catId=cat-1&userId=user-1`,
      )
    })

    it('passes an ApiError through untouched', async () => {
      const err = new ApiError(400, 'VALIDATION_FAILED', 'Invalid request query')
      vi.mocked(httpService.get).mockRejectedValue(err)

      await expect(reviewService.query({ catId: 'nope' })).rejects.toBe(err)
    })
  })
})
