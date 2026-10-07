import { Router } from 'express'
import { loginSchema, signupSchema } from '@cat-store/shared'
import { validateBody } from '../../middlewares/validate.middleware.ts'
import { getMe, login, logout, signup } from './auth.controller.ts'

export const authRoutes = Router()

authRoutes.post('/signup', validateBody(signupSchema), signup)
authRoutes.post('/login', validateBody(loginSchema), login)
authRoutes.post('/logout', logout)
authRoutes.get('/me', getMe)
