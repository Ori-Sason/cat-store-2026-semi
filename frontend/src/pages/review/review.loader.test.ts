import { beforeEach, describe, expect, it, vi } from 'vitest'
import { reviewService } from '../../services/review.service'
import { reviewLoader } from './review.loader'

vi.mock('../../services/review.service')

describe('reviewLoader', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it.each(['catId', 'userId'] as const)("filters by the route's id as %s", (filterKey) => {
    vi.mocked(reviewService.query).mockResolvedValue([])

    reviewLoader({ params: { id: 'id-1' } }, filterKey)

    expect(reviewService.query).toHaveBeenCalledWith({ [filterKey]: 'id-1' })
  })

  // If the loader awaited the reviews, the page would wait on them instead of the skeleton
  it('returns the reviews un-awaited', () => {
    const reviews = new Promise<never>(() => {})
    vi.mocked(reviewService.query).mockReturnValue(reviews)

    expect(reviewLoader({ params: { id: 'cat-1' } }, 'catId')).toEqual({ reviews })
  })

  // A failed call breaks only the reviews section, in its <Await>, never the loader
  it('returns a failed call as a rejected promise, without throwing', async () => {
    vi.mocked(reviewService.query).mockRejectedValue(new Error('down'))

    const { reviews } = reviewLoader({ params: { id: 'cat-1' } }, 'catId')

    await expect(reviews).rejects.toThrow('down')
  })
})
