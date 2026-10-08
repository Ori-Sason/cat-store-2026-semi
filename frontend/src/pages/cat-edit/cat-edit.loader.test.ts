import type { Cat, LoggedInUser } from '@cat-store/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../models/api-error'
import { catService } from '../../services/cat.service'
import { useLoggedInUserStore } from '../../store/logged-in-user.store'
import { catEditLoader } from './cat-edit.loader'

vi.mock('../../services/cat.service')

const CAT = { _id: 'cat-1', ownerId: 'user-1', name: 'Mitzi' } as Cat
const CAT_OWNER: LoggedInUser = { _id: 'user-1', username: 'user', fullname: 'U', isAdmin: false }
const NON_CAT_OWNER_USER: LoggedInUser = { ...CAT_OWNER, _id: 'user-2' }
const ADMIN: LoggedInUser = { _id: 'admin-1', username: 'admin', fullname: 'A', isAdmin: true }

function _load(path: string, id?: string) {
  const request = new Request(`http://localhost${path}`)
  return catEditLoader({ params: id ? { id } : {}, request })
}

// A thrown redirect is a Response with the target in its Location header
async function _getRedirectTo(promise: Promise<unknown>) {
  const res = await promise.catch((err: unknown) => err)
  expect(res).toBeInstanceOf(Response)
  return (res as Response).headers.get('Location')
}

describe('catEditLoader', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useLoggedInUserStore.setState({ loggedInUser: CAT_OWNER })
    vi.mocked(catService.getById).mockResolvedValue(CAT)
  })

  it('gets the cat by the id in the URL on edit', async () => {
    const result = await _load('/cat/cat-1/edit', 'cat-1')

    expect(catService.getById).toHaveBeenCalledWith('cat-1')
    expect(result).toEqual({ cat: CAT })
  })

  it('returns no cat on add, without calling the server', async () => {
    const result = await _load('/cat/new')

    expect(catService.getById).not.toHaveBeenCalled()
    expect(result).toEqual({ cat: null })
  })

  it("lets an admin edit a cat they don't own", async () => {
    useLoggedInUserStore.setState({ loggedInUser: ADMIN })

    expect(await _load('/cat/cat-1/edit', 'cat-1')).toEqual({ cat: CAT })
  })

  it('sends a guest on add to login, and back here after it', async () => {
    useLoggedInUserStore.setState({ loggedInUser: null })

    expect(await _getRedirectTo(_load('/cat/new?x=1'))).toBe(
      `/login?redirectTo=${encodeURIComponent('/cat/new?x=1')}`,
    )
  })

  it('sends a guest on edit to login, without loading the cat', async () => {
    useLoggedInUserStore.setState({ loggedInUser: null })

    expect(await _getRedirectTo(_load('/cat/cat-1/edit', 'cat-1'))).toBe(
      `/login?redirectTo=${encodeURIComponent('/cat/cat-1/edit')}`,
    )
    expect(catService.getById).not.toHaveBeenCalled()
  })

  it("throws FORBIDDEN for a user who doesn't own the cat", async () => {
    useLoggedInUserStore.setState({ loggedInUser: NON_CAT_OWNER_USER })

    await expect(_load('/cat/cat-1/edit', 'cat-1')).rejects.toMatchObject({
      status: 403,
      code: 'FORBIDDEN',
    })
  })

  it('lets CAT_NOT_FOUND through to the route error element', async () => {
    const err = new ApiError(404, 'CAT_NOT_FOUND', 'Cat not found')
    vi.mocked(catService.getById).mockRejectedValue(err)

    await expect(_load('/cat/nope/edit', 'nope')).rejects.toBe(err)
  })
})
