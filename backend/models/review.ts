import type { ObjectId } from 'mongodb'
import type { Review, ReviewWithRefs } from '@cat-store/shared'
import type { CatRefDoc } from './cat.ts'
import type { UserRefDoc } from './user.ts'

export const REVIEW_COLLECTION = 'reviews'

export interface ReviewDoc extends Omit<Review, '_id' | 'userId' | 'catId'> {
  _id: ObjectId
  userId: ObjectId
  catId: ObjectId
}

// The aggregation output behind GET /api/reviews: ReviewWithRefs with ObjectIds.
// aggregate<T>() only asserts it, so the route tests pin the real keys
export interface ReviewJoinedDoc extends Omit<ReviewWithRefs, '_id' | 'user' | 'cat'> {
  _id: ObjectId
  user: UserRefDoc
  cat: CatRefDoc
}
