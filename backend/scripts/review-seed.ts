import { ObjectId } from 'mongodb'
import { reviewSchema } from '@cat-store/shared'
import type { ReviewDoc } from '../models/review.ts'

// The chance each seed user reviews a given cat. Independent per user, so with 5 users about
// 17% of cats get no reviews, most get 1-2, and a few get 3 or more
export const SEED_REVIEW_CHANCE = 0.3

// Each user rolls on their own, so a cat gets 0 to users.length reviews from distinct authors.
// Keeps the users' order
export function pickRandomReviewers<T>(users: T[]): T[] {
  return users.filter(() => Math.random() < SEED_REVIEW_CHANCE)
}

// Validates with the shared schema, so a bad row in reviews.json fails here instead of landing
// in the DB. `createdAt` is a random time between the cat's listing and now: a review never
// predates its cat, and never sits in the future
export function buildSeedReview(
  content: string,
  catId: ObjectId,
  userId: ObjectId,
  catCreatedAt: number,
): ReviewDoc {
  const input = reviewSchema.parse({ catId: catId.toHexString(), content })
  const now = Date.now()
  const createdAt = catCreatedAt + Math.floor(Math.random() * (now - catCreatedAt))
  return {
    _id: new ObjectId(),
    content: input.content,
    catId,
    userId,
    createdAt,
    updatedAt: createdAt,
  }
}
