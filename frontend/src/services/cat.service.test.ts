import Axios from 'axios'
import { DEFAULT_CAT_FILTER, type Cat, type CatInput } from '@cat-store/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../models/api-error'
import { catService } from './cat.service'
import { httpService } from './http.service'

vi.mock('./http.service')

const _ENDPOINT = 'cats'

const _CAT_INPUT: CatInput = {
  name: 'Mitzi',
  price: 120,
  labels: ['Kitten'],
  isInStock: true,
  imgUrl: '',
}

const _CAT: Cat = { ..._CAT_INPUT, _id: 'cat-1', createdAt: 1, updatedAt: 1 }

function _sentParams() {
  return vi.mocked(httpService.get).mock.lastCall?.[1] as URLSearchParams
}

describe('catService', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('query', () => {
    it('returns the cats from the API', async () => {
      vi.mocked(httpService.get).mockResolvedValue([_CAT])

      expect(await catService.query()).toEqual([_CAT])
    })

    it('sends no params for the default filter', async () => {
      await catService.query()

      expect(httpService.get).toHaveBeenCalledWith(_ENDPOINT, expect.any(URLSearchParams))
      expect(_sentParams().toString()).toBe('')
    })

    it('sends labels as repeated keys', async () => {
      await catService.query({ ...DEFAULT_CAT_FILTER, labels: ['Kitten', 'Calm'] })

      expect(_sentParams().toString()).toBe('labels=Kitten&labels=Calm')
    })

    it('reaches the wire as repeated keys through axios', async () => {
      await catService.query({ ...DEFAULT_CAT_FILTER, labels: ['Kitten', 'Calm'] })

      expect(Axios.getUri({ url: `/api/${_ENDPOINT}`, params: _sentParams() })).toBe(
        `/api/${_ENDPOINT}?labels=Kitten&labels=Calm`,
      )
    })
  })

  it('gets a cat by id', async () => {
    vi.mocked(httpService.get).mockResolvedValue(_CAT)

    expect(await catService.getById('cat-1')).toEqual(_CAT)
    expect(httpService.get).toHaveBeenCalledWith(`${_ENDPOINT}/cat-1`)
  })

  describe('save', () => {
    it('POSTs a cat without an _id', async () => {
      vi.mocked(httpService.post).mockResolvedValue(_CAT)

      expect(await catService.save(_CAT_INPUT)).toEqual(_CAT)
      expect(httpService.post).toHaveBeenCalledWith(_ENDPOINT, _CAT_INPUT)
      expect(httpService.put).not.toHaveBeenCalled()
    })

    it('PUTs a cat with an _id', async () => {
      vi.mocked(httpService.put).mockResolvedValue(_CAT)

      expect(await catService.save(_CAT)).toEqual(_CAT)
      expect(httpService.put).toHaveBeenCalledWith(`${_ENDPOINT}/cat-1`, _CAT)
      expect(httpService.post).not.toHaveBeenCalled()
    })
  })

  it('removes a cat by id', async () => {
    await catService.remove('cat-1')

    expect(httpService.delete).toHaveBeenCalledWith(`${_ENDPOINT}/cat-1`)
  })

  it('passes an ApiError through untouched', async () => {
    const err = new ApiError(404, 'CAT_NOT_FOUND', 'Cat not found')
    vi.mocked(httpService.get).mockRejectedValue(err)

    await expect(catService.getById('nope')).rejects.toBe(err)
  })
})
