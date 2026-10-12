import type { PublicUser } from '@cat-store/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../models/api-error'
import { httpService } from './http.service'
import { userService } from './user.service'

vi.mock('./http.service')

const _USER: PublicUser = { _id: 'user-1', fullname: 'Maya Levi', isAdmin: false, createdAt: 1 }

describe('userService', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('gets a user by id', async () => {
    vi.mocked(httpService.get).mockResolvedValue(_USER)

    expect(await userService.getById('user-1')).toEqual(_USER)
    expect(httpService.get).toHaveBeenCalledWith('users/user-1')
  })

  it('passes an ApiError through untouched', async () => {
    const err = new ApiError(404, 'USER_NOT_FOUND', 'User not found')
    vi.mocked(httpService.get).mockRejectedValue(err)

    await expect(userService.getById('nope')).rejects.toBe(err)
  })
})
