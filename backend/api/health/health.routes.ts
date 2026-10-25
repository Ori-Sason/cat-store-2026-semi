import { Router } from 'express'
import { getHealth } from './health.controller.ts'

export const healthRoutes = Router()

healthRoutes.get('/', getHealth)
