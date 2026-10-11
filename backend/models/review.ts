import type { ObjectId } from 'mongodb'
import type { Review } from '@cat-store/shared'

export const REVIEW_COLLECTION = 'reviews'

export interface ReviewDoc extends Omit<Review, '_id' | 'userId' | 'catId'> {
  _id: ObjectId
  userId: ObjectId
  catId: ObjectId
}
