import type { ObjectId } from 'mongodb'
import type { User } from '@cat-store/shared'

export const USER_COLLECTION = 'users'

// `password` is the bcrypt hash, never the plain text. It never leaves the backend
export interface UserDoc extends Omit<User, '_id'> {
  _id: ObjectId
  password: string
}
