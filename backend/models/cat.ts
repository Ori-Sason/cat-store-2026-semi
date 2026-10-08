import type { ObjectId } from 'mongodb'
import type { Cat } from '@cat-store/shared'

export const CAT_COLLECTION = 'cats'

export interface CatDoc extends Omit<Cat, '_id' | 'ownerId'> {
  _id: ObjectId
  ownerId: ObjectId
}
