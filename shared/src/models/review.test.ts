import { describe, expect, it } from 'vitest'
import {
  REVIEW_CONTENT_MAX_LENGTH,
  reviewContentSchema,
  reviewFilterSchema,
  reviewSchema,
  type ReviewInput,
} from './review.ts'

const validReview: ReviewInput = {
  catId: '652f1c2e9b1e8a3d4c5b6a79',
  content: 'Sweet and calm, loves laps.',
}

const _issuePaths = (input: unknown) => {
  const result = reviewSchema.safeParse(input)
  if (result.success) return []
  return result.error.issues.map((issue) => issue.path.join('.'))
}

describe('reviewSchema', () => {
  it('accepts a valid review as is', () => {
    expect(reviewSchema.parse(validReview)).toEqual(validReview)
  })

  it('strips userId and server-set fields', () => {
    const parsed = reviewSchema.parse({
      ...validReview,
      _id: 'abc',
      userId: 'u1',
      createdAt: 1,
      updatedAt: 2,
    })
    expect(parsed).toEqual(validReview)
  })

  describe('catId', () => {
    it('accepts uppercase hex', () => {
      const catId = validReview.catId.toUpperCase()
      expect(reviewSchema.parse({ ...validReview, catId }).catId).toBe(catId)
    })

    it.each([
      ['missing', undefined],
      ['empty', ''],
      ['too short', '652f1c2e9b1e8a3d4c5b6a7'],
      ['not hex', 'zzzzzzzzzzzzzzzzzzzzzzzz'],
      // ObjectId.isValid accepts any 12-character string. The schema must not
      ['12 characters', 'twelve chars'],
      ['a number', 123],
    ])('rejects a catId that is %s', (_, catId) => {
      expect(_issuePaths({ ...validReview, catId })).toEqual(['catId'])
    })
  })

  describe('content', () => {
    it('trims whitespace', () => {
      expect(reviewSchema.parse({ ...validReview, content: '  Lovely  ' }).content).toBe('Lovely')
    })

    it('accepts a single character', () => {
      expect(reviewSchema.parse({ ...validReview, content: '!' }).content).toBe('!')
    })

    it('accepts exactly the max length', () => {
      const content = 'a'.repeat(REVIEW_CONTENT_MAX_LENGTH)
      expect(reviewSchema.parse({ ...validReview, content }).content).toBe(content)
    })

    it.each([
      ['missing', undefined],
      ['empty', ''],
      ['only spaces', '   '],
      ['too long', 'a'.repeat(REVIEW_CONTENT_MAX_LENGTH + 1)],
      ['a number', 5],
    ])('rejects content that is %s', (_, content) => {
      expect(_issuePaths({ ...validReview, content })).toEqual(['content'])
    })
  })
})

describe('reviewContentSchema', () => {
  it('keeps only content, so an edit cannot move a review to another cat', () => {
    expect(reviewContentSchema.parse({ ...validReview, userId: 'u1' })).toEqual({
      content: validReview.content,
    })
  })

  it('applies the same content rules', () => {
    expect(reviewContentSchema.safeParse({ content: '   ' }).success).toBe(false)
  })
})

describe('reviewFilterSchema', () => {
  const catId = validReview.catId
  const userId = '652f1c2e9b1e8a3d4c5b6a80'

  it.each([
    ['catId', { catId }],
    ['userId', { userId }],
    ['both', { catId, userId }],
  ])('accepts a filter by %s', (_, filter) => {
    expect(reviewFilterSchema.parse(filter)).toEqual(filter)
  })

  it('strips unknown params', () => {
    expect(reviewFilterSchema.parse({ catId, sortBy: 'content' })).toEqual({ catId })
  })

  it('rejects an empty filter, so there is no system-wide list', () => {
    expect(reviewFilterSchema.safeParse({}).success).toBe(false)
  })

  it.each([
    ['a malformed catId', { catId: 'nope' }],
    ['a malformed userId', { catId, userId: 'twelve chars' }],
    // a repeated query param (?catId=a&catId=b) arrives as an array
    ['a repeated catId', { catId: [catId, catId] }],
  ])('rejects %s', (_, filter) => {
    expect(reviewFilterSchema.safeParse(filter).success).toBe(false)
  })
})
