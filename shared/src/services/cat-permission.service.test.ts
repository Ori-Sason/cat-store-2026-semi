import { describe, expect, it } from 'vitest'
import { catPermissionService } from './cat-permission.service.ts'

const CAT_OWNER_ID = 'user-1'
const CAT_OWNER = { _id: 'user-1', isAdmin: false }
const NON_CAT_OWNER_USER = { _id: 'user-2', isAdmin: false }
const ADMIN = { _id: 'admin-1', isAdmin: true }

describe('catPermissionService.canAddCat', () => {
  it('lets any logged-in user add a cat', () => {
    expect(catPermissionService.canAddCat(NON_CAT_OWNER_USER)).toBe(true)
    expect(catPermissionService.canAddCat(ADMIN)).toBe(true)
  })

  it('blocks a guest', () => {
    expect(catPermissionService.canAddCat(null)).toBe(false)
  })
})

describe('catPermissionService.canEditCat', () => {
  it("lets the cat's owner edit it", () => {
    expect(catPermissionService.canEditCat(CAT_OWNER_ID, CAT_OWNER)).toBe(true)
  })

  it("lets an admin edit a cat they don't own", () => {
    expect(catPermissionService.canEditCat(CAT_OWNER_ID, ADMIN)).toBe(true)
  })

  it("blocks a user who doesn't own the cat", () => {
    expect(catPermissionService.canEditCat(CAT_OWNER_ID, NON_CAT_OWNER_USER)).toBe(false)
  })

  it('blocks a guest', () => {
    expect(catPermissionService.canEditCat(CAT_OWNER_ID, null)).toBe(false)
  })

  it("lets only an admin edit a cat whose owner's user is gone", () => {
    expect(catPermissionService.canEditCat(null, ADMIN)).toBe(true)
    expect(catPermissionService.canEditCat(null, NON_CAT_OWNER_USER)).toBe(false)
  })
})
