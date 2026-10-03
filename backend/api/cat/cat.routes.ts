import { Router } from 'express'
import { getCats } from './cat.controller.ts'

export const catRoutes = Router()

catRoutes.get('/', getCats)
