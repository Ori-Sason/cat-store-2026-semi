import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { ObjectId } from 'mongodb'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { REVIEW_CONTENT_MAX_LENGTH } from '@cat-store/shared'
import { buildSeedReview, pickRandomReviewers, SEED_REVIEW_CHANCE } from './review-seed.ts'

const CAT_CREATED_AT = 1587412322759

describe('pickRandomReviewers', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('picks every user when every roll is under the chance, in order', () => {
    vi.spyOn(Math, 'random').mockReturnValue(SEED_REVIEW_CHANCE - 0.01)
    expect(pickRandomReviewers(['a', 'b', 'c'])).toEqual(['a', 'b', 'c'])
  })

  it('picks no one when every roll hits the chance or above', () => {
    vi.spyOn(Math, 'random').mockReturnValue(SEED_REVIEW_CHANCE)
    expect(pickRandomReviewers(['a', 'b', 'c'])).toEqual([])
  })

  it('rolls once per user', () => {
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.99).mockReturnValueOnce(0)
    expect(pickRandomReviewers(['a', 'b', 'c'])).toEqual(['a', 'c'])
  })
})

describe('buildSeedReview', () => {
  const catId = new ObjectId()
  const userId = new ObjectId()

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('builds a review on the given cat, by the given user, with trimmed content', () => {
    const review = buildSeedReview('  Lovely cat.  ', catId, userId, CAT_CREATED_AT)
    expect(review).toMatchObject({ content: 'Lovely cat.', catId, userId })
    expect(review._id).toBeInstanceOf(ObjectId)
    expect(review.updatedAt).toBe(review.createdAt)
  })

  it("dates the review between the cat's createdAt and now", () => {
    for (let i = 0; i < 100; i++) {
      const before = Date.now()
      const { createdAt } = buildSeedReview('Lovely cat.', catId, userId, CAT_CREATED_AT)
      expect(createdAt).toBeGreaterThanOrEqual(CAT_CREATED_AT)
      expect(createdAt).toBeLessThanOrEqual(before + 1000)
    }
  })

  it('hits both ends of the range on the extreme rolls', () => {
    vi.spyOn(Date, 'now').mockReturnValue(CAT_CREATED_AT + 1000)
    vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0.9999)
    expect(buildSeedReview('Lovely cat.', catId, userId, CAT_CREATED_AT).createdAt).toBe(
      CAT_CREATED_AT,
    )
    expect(buildSeedReview('Lovely cat.', catId, userId, CAT_CREATED_AT).createdAt).toBe(
      CAT_CREATED_AT + 999,
    )
  })

  it('throws on content the schema rejects', () => {
    expect(() => buildSeedReview('   ', catId, userId, CAT_CREATED_AT)).toThrow()
    const tooLong = 'a'.repeat(REVIEW_CONTENT_MAX_LENGTH + 1)
    expect(() => buildSeedReview(tooLong, catId, userId, CAT_CREATED_AT)).toThrow()
  })

  it('builds every review in reviews.json', () => {
    const contents: string[] = JSON.parse(
      readFileSync(join(import.meta.dirname, 'data', 'reviews.json'), 'utf8'),
    )
    expect(contents.length).toBeGreaterThan(0)
    expect(() =>
      contents.map((content) => buildSeedReview(content, catId, userId, CAT_CREATED_AT)),
    ).not.toThrow()
  })
})
