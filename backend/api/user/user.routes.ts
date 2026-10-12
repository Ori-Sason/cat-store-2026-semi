import { Router } from 'express'
import { getUserById } from './user.controller.ts'

export const userRoutes = Router()

userRoutes.get('/:id', getUserById)
