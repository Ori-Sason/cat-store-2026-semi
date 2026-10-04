import { DEFAULT_CAT_FILTER, type Cat } from '@cat-store/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../models/api-error'
import { catService } from '../../services/cat.service'
import { catAppLoader } from './cat-app.loader'

vi.mock('../../services/cat.service')

const _CATS = [{ _id: 'cat-1', name: 'Mitzi' }] as Cat[]

function _request(path: string) {
  return new Request(`http://localhost${path}`)
}

describe('catAppLoader', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('queries the cats with the filter parsed from the URL', async () => {
    vi.mocked(catService.query).mockResolvedValue(_CATS)

    const result = await catAppLoader({ request: _request('/cat?labels=Calm&sortBy=price') })

    const filterBy = { ...DEFAULT_CAT_FILTER, labels: ['Calm'], sortBy: 'price' }
    expect(catService.query).toHaveBeenCalledWith(filterBy)
    expect(result).toEqual({ cats: _CATS, filterBy })
  })

  it('uses the default filter for a bare URL', async () => {
    vi.mocked(catService.query).mockResolvedValue([])

    await catAppLoader({ request: _request('/cat') })

    expect(catService.query).toHaveBeenCalledWith(DEFAULT_CAT_FILTER)
  })

  it('lets an API error through to the route error element', async () => {
    const err = new ApiError(0, 'NETWORK_ERROR', 'Network Error')
    vi.mocked(catService.query).mockRejectedValue(err)

    await expect(catAppLoader({ request: _request('/cat') })).rejects.toBe(err)
  })
})
