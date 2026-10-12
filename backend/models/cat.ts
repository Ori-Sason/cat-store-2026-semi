import type { ObjectId } from 'mongodb'
import type { CAT_REF_FIELDS, Cat, CatWithRefs } from '@cat-store/shared'
import type { UserRefDoc } from './user.ts'

export const CAT_COLLECTION = 'cats'

export interface CatDoc extends Omit<Cat, '_id' | 'ownerId'> {
  _id: ObjectId
  ownerId: ObjectId
}

// The DB-side shape of the shared CatRef. Its field list (CAT_REF_FIELDS) lives in shared, so the
// wire type and the projection can't drift apart. Picked from CatDoc, since both `_id` and
// ownerId are ObjectIds here
export type CatRefDoc = Pick<CatDoc, '_id' | (typeof CAT_REF_FIELDS)[number]>

// The aggregation output behind GET /api/cats/:id: CatWithRefs with ObjectIds.
// aggregate<T>() only asserts it, so the route tests pin the real keys
export interface CatJoinedDoc extends Omit<CatWithRefs, '_id' | 'owner'> {
  _id: ObjectId
  owner: UserRefDoc
}
