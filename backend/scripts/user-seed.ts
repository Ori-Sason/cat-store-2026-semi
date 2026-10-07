import bcrypt from 'bcrypt'
import { userSchema } from '@cat-store/shared'
import { BCRYPT_SALT_ROUNDS } from '../api/auth/auth.service.ts'
import { userService } from '../api/user/user.service.ts'

export const SEED_USERS = [
  { username: 'user', fullname: 'Regular User', isAdmin: false },
  { username: 'admin', fullname: 'Admin User', isAdmin: true },
]

// Creates each seed user that's missing and never touches an existing one, so dev accounts
// keep their _id across re-seeds. An existing user whose hash doesn't match `password` fails
// the seed (a silent mismatch would show up later as a confusing login failure).
export async function seedUsers(password: string): Promise<string[]> {
  const createdUsers: string[] = []
  const mismatchedUsers: string[] = []

  for (const { isAdmin, ...seedUser } of SEED_USERS) {
    // Validates the env password against the signup rules too
    const input = userSchema.parse({ ...seedUser, password })
    const existingUser = await userService.getByUsername(input.username)

    if (existingUser) {
      const isMatch = await bcrypt.compare(input.password, existingUser.password)
      if (!isMatch) mismatchedUsers.push(input.username)
      continue
    }

    await userService.add({
      ...input,
      password: await bcrypt.hash(input.password, BCRYPT_SALT_ROUNDS),
      isAdmin,
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
