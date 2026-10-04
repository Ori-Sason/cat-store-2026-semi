import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../models/api-error'
import { catService } from '../../services/cat.service'
import { useUserMsgStore } from '../../store/user-msg.store'
import { catDetailsAction } from './cat-details.action'

vi.mock('../../services/cat.service')

const store = () => useUserMsgStore.getState()

describe('catDetailsAction', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useUserMsgStore.setState({ msg: null, navigationMsg: null })
  })

  it('deletes the cat, queues a message and redirects to the list', async () => {
    vi.mocked(catService.remove).mockResolvedValue()

    const result = await catDetailsAction({ params: { id: 'cat-1' } })

    expect(catService.remove).toHaveBeenCalledWith('cat-1')
    expect(store().navigationMsg).toMatchObject({ txt: 'Cat deleted', type: 'success' })
    expect(result).toBeInstanceOf(Response)
    expect((result as Response).headers.get('Location')).toBe('/cat')
  })

  it('shows the error and stays when the delete fails', async () => {
    vi.mocked(catService.remove).mockRejectedValue(
      new ApiError(0, 'NETWORK_ERROR', 'Network Error'),
    )

    const result = await catDetailsAction({ params: { id: 'cat-1' } })

    expect(result).toBeNull()
    expect(store().msg).toMatchObject({
      txt: "Can't reach the server. Check your connection.",
      type: 'error',
    })
    expect(store().navigationMsg).toBeNull()
  })
})
