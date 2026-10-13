import { z } from 'zod'
import { sharedUtilService } from '../services/util.service.ts'
import type { CatRef } from './cat.ts'
import type { UserRef } from './user.ts'

export const REVIEW_CONTENT_MAX_LENGTH = 500

const _content = z
  .string({ error: 'Review is required' })
  .trim()
  .min(1, { error: 'Review is required' })
  .max(REVIEW_CONTENT_MAX_LENGTH, {
    error: `Review must be at most ${REVIEW_CONTENT_MAX_LENGTH} characters`,
  })

// A 24-hex id string - the same check as the backend's toObjectId. A query param that's
// repeated (?catId=a&catId=b) arrives as an array and fails here too
function _objectId(invalidError: string, requiredError = invalidError) {
  return z
    .string({ error: requiredError })
    .regex(sharedUtilService.getObjectIdRegex(), { error: invalidError })
}

// What adding a review sends. `userId` is left out on purpose: the server sets it from the
// verified user, and Zod strips unknown keys, so a client can't post as someone else
export const reviewSchema = z.object({
  catId: _objectId('Invalid cat', 'Cat is required'),
  content: _content,
})

export type ReviewInput = z.infer<typeof reviewSchema>

// What editing a review sends (PUT body, edit form). Content only: a review stays on its cat
export const reviewContentSchema = reviewSchema.pick({ content: true })

export type ReviewContentInput = z.infer<typeof reviewContentSchema>

export interface Review extends ReviewInput {
  _id: string
  userId: string // the author - server-set, so it's not in reviewSchema
  createdAt: number
  updatedAt: number
}

// A review joined with its author and its cat (GET /api/reviews). userId / catId are replaced
// by the slim `user` / `cat`, and the user side never carries the password or username.
// One shape for the cat page and the user page: each ignores the side it already shows
export interface ReviewWithRefs extends Omit<Review, 'userId' | 'catId'> {
  user: UserRef
  cat: CatRef
}

// Which reviews GET /api/reviews returns. Both → AND
export const reviewFilterSchema = z
  .object({
    catId: _objectId('Invalid cat').optional(),
    userId: _objectId('Invalid user').optional(),
  })
  .refine(({ catId, userId }) => catId !== undefined || userId !== undefined, {
    error: 'Filter by catId or userId',
  })

export type ReviewFilter = z.infer<typeof reviewFilterSchema>
