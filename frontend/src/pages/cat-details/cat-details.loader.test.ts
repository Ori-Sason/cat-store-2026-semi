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

  // The reviews have their own child route loader, so a review action can reload them alone
  it('returns the cat only, without loading the reviews', async () => {
    vi.mocked(catService.getById).mockResolvedValue(_CAT)

    const result = await catDetailsLoader({ params: { id: 'cat-1' } })

    expect(catService.getById).toHaveBeenCalledWith('cat-1')
    expect(result).toEqual({ cat: _CAT })
    expect(reviewService.query).not.toHaveBeenCalled()
  })

  it('lets CAT_NOT_FOUND through to the route error element', async () => {
    const err = new ApiError(404, 'CAT_NOT_FOUND', 'Cat not found')
    vi.mocked(catService.getById).mockRejectedValue(err)

    await expect(catDetailsLoader({ params: { id: 'nope' } })).rejects.toBe(err)
  })
})
