import type { ObjectId } from 'mongodb'
import type { PublicUser, User, UserRef } from '@cat-store/shared'

export const USER_COLLECTION = 'users'

// `password` is the bcrypt hash, never the plain text. It never leaves the backend
export interface UserDoc extends Omit<User, '_id'> {
  _id: ObjectId
  password: string
}

// The DB-side shapes of the shared PublicUser and UserRef. Their field lists
// (PUBLIC_USER_FIELDS, USER_REF_FIELDS) live in shared, so the wire types and the projections
// can't drift apart. Only `_id` differs: an ObjectId here, a string once serialized
export type PublicUserDoc = Omit<PublicUser, '_id'> & Pick<UserDoc, '_id'>

export type UserRefDoc = Omit<UserRef, '_id'> & Pick<UserDoc, '_id'>
