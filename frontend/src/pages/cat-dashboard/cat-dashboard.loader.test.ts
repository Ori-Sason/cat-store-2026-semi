import type { CatLabelStats } from '@cat-store/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../models/api-error'
import { catService } from '../../services/cat.service'
import { catDashboardLoader } from './cat-dashboard.loader'

vi.mock('../../services/cat.service')

const _STATS: CatLabelStats[] = [
  { label: 'Kitten', count: 2, inStockCount: 1, medianPrice: 100, minPrice: 80, maxPrice: 120 },
]

describe('catDashboardLoader', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('gets the label stats', async () => {
    vi.mocked(catService.getLabelStats).mockResolvedValue(_STATS)

    expect(await catDashboardLoader()).toEqual({ labelStats: _STATS })
  })

  it('lets an ApiError through to the route error element', async () => {
    const err = new ApiError(0, 'NETWORK_ERROR', 'Network Error')
    vi.mocked(catService.getLabelStats).mockRejectedValue(err)

    await expect(catDashboardLoader()).rejects.toBe(err)
  })
})
