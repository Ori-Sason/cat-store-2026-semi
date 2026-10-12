import { MongoServerError, ObjectId } from 'mongodb'
import { PUBLIC_USER_FIELDS } from '@cat-store/shared'
import { HttpError } from '../../models/http-error.ts'
import { USER_COLLECTION, type PublicUserDoc, type UserDoc } from '../../models/user.ts'
import { mongoService } from '../../services/mongodb.service.ts'
import { utilService } from '../../services/util.service.ts'

// Mongo's code for a unique index violation
const _DUPLICATE_KEY_ERROR_CODE = 11000

// null for a malformed id too. Unlike catService.getById this doesn't throw: getMe treats a
// missing user as a guest.
async function getById(userId: string): Promise<UserDoc | null> {
  const _id = utilService.toObjectId(userId)
  if (!_id) return null
  const collection = await mongoService.getCollection<UserDoc>(USER_COLLECTION)
  return collection.findOne({ _id })
}

// For user profile page. The projection is the allow-list, so the password never leaves the DB.
// null for a missing user or a malformed id, like getById
async function getPublicById(userId: string): Promise<PublicUserDoc | null> {
  const _id = utilService.toObjectId(userId)
  if (!_id) return null
  const projection = Object.fromEntries(PUBLIC_USER_FIELDS.map((field) => [field, 1]))
  const collection = await mongoService.getCollection<UserDoc>(USER_COLLECTION)
  return collection.findOne<PublicUserDoc>({ _id }, { projection })
}

async function getByUsername(username: string): Promise<UserDoc | null> {
  const collection = await mongoService.getCollection<UserDoc>(USER_COLLECTION)
  return collection.findOne({ username })
}

// `password` must already be a bcrypt hash. Hashing is authService's job
async function add(input: Omit<UserDoc, '_id' | 'createdAt' | 'updatedAt'>): Promise<UserDoc> {
  const now = Date.now()
  const user: UserDoc = { _id: new ObjectId(), ...input, createdAt: now, updatedAt: now }
  const collection = await mongoService.getCollection<UserDoc>(USER_COLLECTION)
  try {
    // No findOne first: the unique index decides, so two signups racing for one name can't both win
    await collection.insertOne(user)
  } catch (err) {
    if (err instanceof MongoServerError && err.code === _DUPLICATE_KEY_ERROR_CODE) {
      throw new HttpError(409, 'USERNAME_TAKEN', `Username "${input.username}" is taken`) // 409 Conflict
    }
    throw err
  }
  return user
}

export const userService = {
  getById,
  getPublicById,
  getByUsername,
  add,
}
