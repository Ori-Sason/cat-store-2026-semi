import { Router } from 'express'
import { getCatById, getCats } from './cat.controller.ts'

export const catRoutes = Router()

catRoutes.get('/', getCats)
catRoutes.get('/:id', getCatById)
