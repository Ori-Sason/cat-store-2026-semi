import { describe, expect, it } from 'vitest'
import { reviewPermissionService } from './review-permission.service.ts'

const REVIEW = { userId: 'user-1' }
const REVIEW_AUTHOR = { _id: 'user-1', isAdmin: false }
const NON_REVIEW_AUTHOR_USER = { _id: 'user-2', isAdmin: false }
const ADMIN = { _id: 'admin-1', isAdmin: true }

describe('reviewPermissionService.canAddReview', () => {
  it('lets any logged-in user add a review', () => {
    expect(reviewPermissionService.canAddReview(NON_REVIEW_AUTHOR_USER)).toBe(true)
    expect(reviewPermissionService.canAddReview(ADMIN)).toBe(true)
  })

  it('blocks a guest', () => {
    expect(reviewPermissionService.canAddReview(null)).toBe(false)
  })
})

describe('reviewPermissionService.canEditReview', () => {
  it("lets the review's author edit it", () => {
    expect(reviewPermissionService.canEditReview(REVIEW, REVIEW_AUTHOR)).toBe(true)
  })

  it("lets an admin edit a review they didn't write", () => {
    expect(reviewPermissionService.canEditReview(REVIEW, ADMIN)).toBe(true)
  })

  it("blocks a user who didn't write the review", () => {
    expect(reviewPermissionService.canEditReview(REVIEW, NON_REVIEW_AUTHOR_USER)).toBe(false)
  })

  it('blocks a guest', () => {
    expect(reviewPermissionService.canEditReview(REVIEW, null)).toBe(false)
  })
})
