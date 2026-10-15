import { Router } from 'express'
import { catSchema } from '@cat-store/shared'
import { requireAuth } from '../../middlewares/http/require-auth.middleware.ts'
import { requireCatOwner } from '../../middlewares/http/require-cat-owner.middleware.ts'
import { validateBody } from '../../middlewares/http/validate.middleware.ts'
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
catRoutes.post('/', requireAuth, validateBody(catSchema), addCat)
// requireCatOwner (which includes requireAuth) runs before validateBody, so a non-owner gets a 403, not a 400
catRoutes.put('/:id', requireCatOwner, validateBody(catSchema), updateCat)
catRoutes.delete('/:id', requireCatOwner, removeCat)
