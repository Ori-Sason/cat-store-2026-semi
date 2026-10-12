import type { ObjectId } from 'mongodb'
import type { User } from '@cat-store/shared'

export const USER_COLLECTION = 'users'

// `password` is the bcrypt hash, never the plain text. It never leaves the backend
export interface UserDoc extends Omit<User, '_id'> {
  _id: ObjectId
  password: string
}

// The user fields a joined doc (e.g. a review's author) may carry, besides `_id`. An allow-list,
// so a field added to users later (a secret, say) stays out of every join by default
export const USER_REF_FIELDS = ['fullname'] as const satisfies readonly (keyof UserDoc)[]

// The fields GET /api/users/:id returns, besides `_id` (PublicUser). An allow-list, like the refs:
// no username (half a login) and never the password
export const PUBLIC_USER_FIELDS = [
  'fullname',
  'isAdmin',
  'createdAt',
] as const satisfies readonly (keyof UserDoc)[]

export type PublicUserDoc = Pick<UserDoc, '_id' | (typeof PUBLIC_USER_FIELDS)[number]>

export type UserRefDoc = Pick<UserDoc, '_id' | (typeof USER_REF_FIELDS)[number]>
