import { Router } from 'express'
import { catSchema } from '@cat-store/shared'
import { validateBody } from '../../middlewares/validate.middleware.ts'
import {
  addCat,
  getCatById,
  getCatLabelStats,
  getCats,
  removeCat,
  updateCat,
} from './cat.controller.ts'

export const catRoutes = Router()

catRoutes.get('/', getCats)
catRoutes.get('/stats', getCatLabelStats)
catRoutes.get('/:id', getCatById)
catRoutes.post('/', validateBody(catSchema), addCat)
catRoutes.put('/:id', validateBody(catSchema), updateCat)
catRoutes.delete('/:id', removeCat)
