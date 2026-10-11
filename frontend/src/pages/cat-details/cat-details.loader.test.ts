import type { Cat } from '@cat-store/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../models/api-error'
import { catService } from '../../services/cat.service'
import { reviewService } from '../../services/review.service'
import { catDetailsLoader } from './cat-details.loader'

vi.mock('../../services/cat.service')
vi.mock('../../services/review.service')

const _CAT = { _id: 'cat-1', name: 'Mitzi' } as Cat

describe('catDetailsLoader', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  // If the loader awaited the reviews, it would hang here and the page would wait on them
  it('awaits the cat and returns the reviews un-awaited', async () => {
    const reviews = new Promise<never>(() => {})
    vi.mocked(catService.getById).mockResolvedValue(_CAT)
    vi.mocked(reviewService.query).mockReturnValue(reviews)

    const result = await catDetailsLoader({ params: { id: 'cat-1' } })

    expect(catService.getById).toHaveBeenCalledWith('cat-1')
    expect(reviewService.query).toHaveBeenCalledWith({ catId: 'cat-1' })
    expect(result).toEqual({ cat: _CAT, reviews })
  })

  it('lets CAT_NOT_FOUND through to the route error element', async () => {
    const err = new ApiError(404, 'CAT_NOT_FOUND', 'Cat not found')
    vi.mocked(catService.getById).mockRejectedValue(err)
    vi.mocked(reviewService.query).mockReturnValue(new Promise(() => {}))

    await expect(catDetailsLoader({ params: { id: 'nope' } })).rejects.toBe(err)
  })

  // The reviews are a separate section: their failure must not fail the loader
  it('still returns the cat when the reviews call fails', async () => {
    vi.mocked(catService.getById).mockResolvedValue(_CAT)
    vi.mocked(reviewService.query).mockRejectedValue(new Error('down'))

    const result = await catDetailsLoader({ params: { id: 'cat-1' } })

    expect(result.cat).toBe(_CAT)
    await expect(result.reviews).rejects.toThrow('down')
  })
})
