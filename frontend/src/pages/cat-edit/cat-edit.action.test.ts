import type { Cat, CatInput } from '@cat-store/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../models/api-error'
import { catService } from '../../services/cat.service'
import { useUserMsgStore } from '../../store/user-msg.store'
import { catEditAction } from './cat-edit.action'

vi.mock('../../services/cat.service')

const _CAT_INPUT = {
  name: 'Mitzi',
  price: 95.5,
  labels: ['Calm'],
  isInStock: true,
  imgUrl: '',
} satisfies CatInput

const _SAVED_CAT = { ..._CAT_INPUT, _id: 'cat-1', createdAt: 1, updatedAt: 1 } satisfies Cat

const store = () => useUserMsgStore.getState()

function _request(body: unknown) {
  return new Request('http://localhost/cat/new', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('catEditAction', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useUserMsgStore.setState({ msg: null, navigationMsg: null })
  })

  it('adds a cat without an _id and redirects to its details', async () => {
    vi.mocked(catService.save).mockResolvedValue(_SAVED_CAT)

    const result = await catEditAction({ params: {}, request: _request(_CAT_INPUT) })

    expect(catService.save).toHaveBeenCalledWith(_CAT_INPUT)
    expect(store().navigationMsg).toMatchObject({ txt: 'Cat saved', type: 'success' })
    expect((result as Response).headers.get('Location')).toBe('/cat/cat-1')
  })

  it('updates the cat with the id in the URL and redirects to its details', async () => {
    vi.mocked(catService.save).mockResolvedValue(_SAVED_CAT)

    const result = await catEditAction({ params: { id: 'cat-1' }, request: _request(_CAT_INPUT) })

    expect(catService.save).toHaveBeenCalledWith({ ..._CAT_INPUT, _id: 'cat-1' })
    expect(store().navigationMsg).toMatchObject({ txt: 'Cat saved', type: 'success' })
    expect((result as Response).headers.get('Location')).toBe('/cat/cat-1')
  })

  it('shows the error and returns an error status when the save fails', async () => {
    vi.mocked(catService.save).mockRejectedValue(new ApiError(0, 'NETWORK_ERROR', 'Network Error'))

    const result = await catEditAction({ params: {}, request: _request(_CAT_INPUT) })

    expect(result).toMatchObject({ data: null, init: { status: 500 } })
    expect(store().msg).toMatchObject({
      txt: "Can't reach the server. Check your connection.",
      type: 'error',
    })
    expect(store().navigationMsg).toBeNull()
  })
})
