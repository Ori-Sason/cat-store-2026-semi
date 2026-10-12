import Axios from 'axios'
import type { Review, ReviewWithRefs } from '@cat-store/shared'
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
  user: { _id: 'user-1', fullname: 'Maya Levi', isAdmin: false },
  cat: { _id: 'cat-1', name: 'Mitzi', imgUrl: '', ownerId: 'user-2' },
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

  describe('add', () => {
    it('posts the review and returns the stored one', async () => {
      const input = { catId: 'cat-1', content: 'Sweet and calm' }
      const saved: Review = {
        ...input,
        _id: 'review-1',
        userId: 'user-1',
        createdAt: 1,
        updatedAt: 1,
      }
      vi.mocked(httpService.post).mockResolvedValue(saved)

      expect(await reviewService.add(input)).toEqual(saved)
      expect(httpService.post).toHaveBeenCalledWith(_ENDPOINT, input)
    })
  })

  describe('update', () => {
    it('puts the content to the review and returns the stored one', async () => {
      const saved: Review = {
        _id: 'review-1',
        catId: 'cat-1',
        userId: 'user-1',
        content: 'Even sweeter',
        createdAt: 1,
        updatedAt: 2,
      }
      vi.mocked(httpService.put).mockResolvedValue(saved)

      expect(await reviewService.update('review-1', { content: 'Even sweeter' })).toEqual(saved)
      expect(httpService.put).toHaveBeenCalledWith(`${_ENDPOINT}/review-1`, {
        content: 'Even sweeter',
      })
    })
  })

  describe('remove', () => {
    it('deletes the review by id', async () => {
      await reviewService.remove('review-1')

      expect(httpService.delete).toHaveBeenCalledWith(`${_ENDPOINT}/review-1`)
    })

    it('passes an ApiError through untouched', async () => {
      const err = new ApiError(403, 'FORBIDDEN', 'Forbidden')
      vi.mocked(httpService.delete).mockRejectedValue(err)

      await expect(reviewService.remove('review-1')).rejects.toBe(err)
    })
  })
})
