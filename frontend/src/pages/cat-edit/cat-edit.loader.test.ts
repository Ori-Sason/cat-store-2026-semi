import type { Cat } from '@cat-store/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../models/api-error'
import { catService } from '../../services/cat.service'
import { catEditLoader } from './cat-edit.loader'

vi.mock('../../services/cat.service')

const _CAT = { _id: 'cat-1', name: 'Mitzi' } as Cat

describe('catEditLoader', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('gets the cat by the id in the URL on edit', async () => {
    vi.mocked(catService.getById).mockResolvedValue(_CAT)

    const result = await catEditLoader({ params: { id: 'cat-1' } })

    expect(catService.getById).toHaveBeenCalledWith('cat-1')
    expect(result).toEqual({ cat: _CAT })
  })

  it('returns no cat on add, without calling the server', async () => {
    const result = await catEditLoader({ params: {} })

    expect(catService.getById).not.toHaveBeenCalled()
    expect(result).toEqual({ cat: null })
  })

  it('lets CAT_NOT_FOUND through to the route error element', async () => {
    const err = new ApiError(404, 'CAT_NOT_FOUND', 'Cat not found')
    vi.mocked(catService.getById).mockRejectedValue(err)

    await expect(catEditLoader({ params: { id: 'nope' } })).rejects.toBe(err)
  })
})
