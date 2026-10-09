import { DEFAULT_CAT_FILTER } from '@cat-store/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { catService } from '../../services/cat.service'
import { homeLoader } from './home.loader'

vi.mock('../../services/cat.service')

describe('homeLoader', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  // If the loader awaited, it would hang here and navigation to / would wait on the API
  it('returns both promises un-awaited', () => {
    const newestCats = new Promise<never>(() => {})
    const labelStats = new Promise<never>(() => {})
    vi.mocked(catService.query).mockReturnValue(newestCats)
    vi.mocked(catService.getLabelStats).mockReturnValue(labelStats)

    const result = homeLoader()

    expect(result.newestCats).toBe(newestCats)
    expect(result.labelStats).toBe(labelStats)
  })

  it('asks for the 4 newest cats on the default filter', () => {
    vi.mocked(catService.query).mockReturnValue(new Promise(() => {}))
    vi.mocked(catService.getLabelStats).mockReturnValue(new Promise(() => {}))

    homeLoader()

    expect(catService.query).toHaveBeenCalledWith({ ...DEFAULT_CAT_FILTER, limit: 4 })
  })
})
