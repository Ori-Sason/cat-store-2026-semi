import { z } from 'zod'
import { sharedUtilService } from '../services/util.service.ts'

export const REVIEW_CONTENT_MAX_LENGTH = 500

const _content = z
  .string({ error: 'Review is required' })
  .trim()
  .min(1, { error: 'Review is required' })
  .max(REVIEW_CONTENT_MAX_LENGTH, {
    error: `Review must be at most ${REVIEW_CONTENT_MAX_LENGTH} characters`,
  })

// What adding a review sends. `userId` is left out on purpose: the server sets it from the
// verified user, and Zod strips unknown keys, so a client can't post as someone else
export const reviewSchema = z.object({
  catId: z
    .string({ error: 'Cat is required' })
    .regex(sharedUtilService.getObjectIdRegex(), { error: 'Invalid cat' }),
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
