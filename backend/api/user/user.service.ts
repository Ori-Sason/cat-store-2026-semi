import { MongoServerError, ObjectId } from 'mongodb'
import { HttpError } from '../../models/http-error.ts'
import { USER_COLLECTION, type UserDoc } from '../../models/user.ts'
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
  getByUsername,
  add,
}
