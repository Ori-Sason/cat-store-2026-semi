import bcrypt from 'bcrypt'
import { ObjectId } from 'mongodb'
import { userSchema } from '@cat-store/shared'
import { USER_COLLECTION, type UserDoc } from '../models/user.ts'
import { mongoService } from '../services/mongodb.service.ts'

// bcrypt cost: each +1 doubles the hash time. 10 is OWASP's minimum, enough for a side
// project. 12 is today's common default (PHP 8.4, Laravel, bcrypt-ruby).
// Moves to the auth service with signup, and this comment moves with it
const BCRYPT_SALT_ROUNDS = 10

export const SEED_USERS = [
  { username: 'user', fullname: 'Regular User', isAdmin: false },
  { username: 'admin', fullname: 'Admin User', isAdmin: true },
]

// Creates each seed user that's missing and never touches an existing one, so dev accounts
// keep their _id across re-seeds. An existing user whose hash doesn't match `password` fails
// the seed (a silent mismatch would show up later as a confusing login failure).
export async function seedUsers(password: string): Promise<string[]> {
  const collection = await mongoService.getCollection<UserDoc>(USER_COLLECTION)
  const createdUsers: string[] = []
  const mismatchedUsers: string[] = []

  for (const { isAdmin, ...seedUser } of SEED_USERS) {
    // Validates the env password against the signup rules too
    const input = userSchema.parse({ ...seedUser, password })
    const existing = await collection.findOne({ username: input.username })

    if (existing) {
      const isMatch = await bcrypt.compare(input.password, existing.password)
      if (!isMatch) mismatchedUsers.push(input.username)
      continue
    }

    const now = Date.now()
    await collection.insertOne({
      _id: new ObjectId(),
      ...input,
      password: await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS),
      isAdmin,
      createdAt: now,
      updatedAt: now,
    })
    createdUsers.push(input.username)
  }

  if (mismatchedUsers.length) {
    throw new Error(
      `SEED_USERS_PASSWORD doesn't match the stored password for: ${mismatchedUsers.join(', ')}. ` +
        'Fix the env var, or delete the user so the seed re-creates it',
    )
  }
  return createdUsers
}
