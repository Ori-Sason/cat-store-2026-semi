import { DEFAULT_CAT_FILTER } from '@cat-store/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { catService } from '../../services/cat.service'
import { userCatsLoader } from './user-cats.loader'

vi.mock('../../services/cat.service')

describe('userCatsLoader', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it("asks for the user's cats, with no limit", () => {
    vi.mocked(catService.query).mockResolvedValue([])

    userCatsLoader({ params: { id: 'user-1' } })

    expect(catService.query).toHaveBeenCalledWith({ ...DEFAULT_CAT_FILTER, ownerId: 'user-1' })
  })

  // If the loader awaited, navigation to the page would wait on the cats
  it('returns the cats un-awaited', () => {
    const cats = new Promise<never>(() => {})
    vi.mocked(catService.query).mockReturnValue(cats)

    expect(userCatsLoader({ params: { id: 'user-1' } }).cats).toBe(cats)
  })
})
