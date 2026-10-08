import bcrypt from 'bcrypt'
import type { ObjectId } from 'mongodb'
import { userSchema } from '@cat-store/shared'
import { BCRYPT_SALT_ROUNDS } from '../api/auth/auth.service.ts'
import { userService } from '../api/user/user.service.ts'

export const SEED_USERS = [
  { username: 'user', fullname: 'Regular User', isAdmin: false },
  { username: 'admin', fullname: 'Admin User', isAdmin: true },
]

export interface SeededUser {
  _id: ObjectId
  username: string
  isAdmin: boolean
  isCreated: boolean
}

// Creates each seed user that's missing and never touches an existing one, so dev accounts
// keep their _id across re-seeds. An existing user whose hash doesn't match `password` fails
// the seed (a silent mismatch would show up later as a confusing login failure).
// Returns every seed user, existing ones included, so a re-seed still gets their _ids.
export async function seedUsers(password: string): Promise<SeededUser[]> {
  const usersToCreate: ((typeof SEED_USERS)[number] & { password: string })[] = []
  const existingUsers: SeededUser[] = []
  const mismatchedUsers: string[] = []

  // Check every user before inserting any, so a mismatch leaves the DB as it was
  for (const { isAdmin, ...seedUser } of SEED_USERS) {
    // Validates the env password against the signup rules too
    const input = userSchema.parse({ ...seedUser, password })
    const existingUser = await userService.getByUsername(input.username)

    if (!existingUser) {
      usersToCreate.push({ ...input, isAdmin })
      continue
    }
    const isMatch = await bcrypt.compare(input.password, existingUser.password)
    if (!isMatch) mismatchedUsers.push(input.username)
    const { _id, username } = existingUser
    existingUsers.push({ _id, username, isAdmin: existingUser.isAdmin, isCreated: false })
  }

  if (mismatchedUsers.length) {
    throw new Error(
      `SEED_USERS_PASSWORD doesn't match the stored password for: ${mismatchedUsers.join(', ')}. ` +
        'Fix the env var, or delete the user so the seed re-creates it',
    )
  }

  const createdUsers: SeededUser[] = []
  for (const user of usersToCreate) {
    const { _id, username, isAdmin } = await userService.add({
      ...user,
      password: await bcrypt.hash(user.password, BCRYPT_SALT_ROUNDS),
    })
    createdUsers.push({ _id, username, isAdmin, isCreated: true })
  }
  // Back in SEED_USERS order, whichever of them were created
  const seededUsers = [...existingUsers, ...createdUsers]
  return SEED_USERS.map(({ username }) => seededUsers.find((user) => user.username === username)!)
}
