import { Router } from 'express'
import { getCatById, getCats, removeCat } from './cat.controller.ts'

export const catRoutes = Router()

catRoutes.get('/', getCats)
catRoutes.get('/:id', getCatById)
catRoutes.delete('/:id', removeCat)
