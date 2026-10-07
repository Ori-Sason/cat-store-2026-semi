import { signupSchema } from '@cat-store/shared'
import { z } from 'zod'

// Confirm password is a client-side check only, and is dropped before submit
export const signupFormSchema = signupSchema
  .extend({ confirmPassword: z.string() })
  .refine((form) => form.password === form.confirmPassword, {
    error: "Passwords don't match",
    path: ['confirmPassword'],
  })
