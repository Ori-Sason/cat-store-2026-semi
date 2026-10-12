import type { PublicUser } from '@cat-store/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../models/api-error'
import { catService } from '../../services/cat.service'
import { userService } from '../../services/user.service'
import { userDetailsLoader } from './user-details.loader'

vi.mock('../../services/user.service')
vi.mock('../../services/cat.service')

const _USER: PublicUser = { _id: 'user-1', fullname: 'Maya Levi', isAdmin: false, createdAt: 1 }

describe('userDetailsLoader', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  // The tabs have their own child route loaders, so only the open tab loads
  it('returns the user only, without loading a tab', async () => {
    vi.mocked(userService.getById).mockResolvedValue(_USER)

    const result = await userDetailsLoader({ params: { id: 'user-1' } })

    expect(userService.getById).toHaveBeenCalledWith('user-1')
    expect(result).toEqual({ user: _USER })
    expect(catService.query).not.toHaveBeenCalled()
  })

  it('lets USER_NOT_FOUND through to the route error element', async () => {
    const err = new ApiError(404, 'USER_NOT_FOUND', 'User not found')
    vi.mocked(userService.getById).mockRejectedValue(err)

    await expect(userDetailsLoader({ params: { id: 'nope' } })).rejects.toBe(err)
  })
})
