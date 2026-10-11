import type { ObjectId } from 'mongodb'
import type { Cat } from '@cat-store/shared'

export const CAT_COLLECTION = 'cats'

export interface CatDoc extends Omit<Cat, '_id' | 'ownerId'> {
  _id: ObjectId
  ownerId: ObjectId
}

// The cat fields a joined doc (e.g. a review's cat) carries, besides `_id`
export const CAT_REF_FIELDS = ['name', 'imgUrl'] as const satisfies readonly (keyof CatDoc)[]

export type CatRefDoc = Pick<CatDoc, '_id' | (typeof CAT_REF_FIELDS)[number]>
