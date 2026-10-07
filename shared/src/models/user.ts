import { z } from 'zod'

export const FULLNAME_MIN_LENGTH = 2
export const FULLNAME_MAX_LENGTH = 50
export const USERNAME_MIN_LENGTH = 3
export const USERNAME_MAX_LENGTH = 20
export const PASSWORD_MIN_LENGTH = 8
// bcrypt hashes only the first 72 bytes and silently drops the rest. 50 characters stays well
// under that for ASCII (1 byte each). Non-ASCII characters take 2-4 bytes, so a long
// non-Latin password can still run past 72. Rare enough to accept here
export const PASSWORD_MAX_LENGTH = 50

// What signup sends. `isAdmin` is left out on purpose: Zod strips unknown keys,
// so a client can never make itself admin
export const userSchema = z.object({
  fullname: z
    .string({ error: 'Full name is required' })
    .trim()
    .min(FULLNAME_MIN_LENGTH, {
      error: `Full name must be at least ${FULLNAME_MIN_LENGTH} characters`,
    })
    .max(FULLNAME_MAX_LENGTH, {
      error: `Full name must be at most ${FULLNAME_MAX_LENGTH} characters`,
    }),

  // Stored lowercased
  username: z
    .string({ error: 'Username is required' })
    .trim()
    .toLowerCase()
    .min(USERNAME_MIN_LENGTH, {
      error: `Username must be at least ${USERNAME_MIN_LENGTH} characters`,
    })
    .max(USERNAME_MAX_LENGTH, {
      error: `Username must be at most ${USERNAME_MAX_LENGTH} characters`,
    })
    .regex(/^[a-z0-9_]+$/, { error: 'Username can only have letters, digits and _' }),

  password: z
    .string({ error: 'Password is required' })
    .min(PASSWORD_MIN_LENGTH, {
      error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    })
    .max(PASSWORD_MAX_LENGTH, {
      error: `Password must be at most ${PASSWORD_MAX_LENGTH} characters`,
    })
    .regex(/[a-z]/, { error: 'Password must have a lowercase letter' })
    .regex(/[A-Z]/, { error: 'Password must have an uppercase letter' })
    .regex(/\d/, { error: 'Password must have a digit' })
    .regex(/[^a-zA-Z0-9]/, { error: 'Password must have a symbol' }),
})

export type UserInput = z.infer<typeof userSchema>

// Remember me: the server keeps the login for days instead of until the browser closes
const isRememberedSchema = z.boolean({ error: 'Remember me must be true or false' }).default(false)

// What signup sends. Confirm password is a client-side check only, so it's not here
export const signupSchema = userSchema.extend({ isRemembered: isRememberedSchema })

export type SignupInput = z.infer<typeof signupSchema>

// What login sends. Presence only, no signup rules: login checks the stored user and hash,
// not the policy, and the policy could change after a user signed up
export const loginSchema = z.object({
  username: z
    .string({ error: 'Username is required' })
    .trim()
    .toLowerCase()
    .min(1, { error: 'Username is required' }),
  password: z.string({ error: 'Password is required' }).min(1, { error: 'Password is required' }),
  isRemembered: isRememberedSchema,
})

export type LoginInput = z.infer<typeof loginSchema>

export interface User extends Omit<UserInput, 'password'> {
  _id: string
  isAdmin: boolean
  createdAt: number
  updatedAt: number
}

export type LoggedInUser = Pick<User, '_id' | 'username' | 'fullname' | 'isAdmin'>
