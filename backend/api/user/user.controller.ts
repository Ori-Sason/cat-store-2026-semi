import type { Request, Response } from 'express'
import { HttpError } from '../../models/http-error.ts'
import { userService } from './user.service.ts'

export async function getUserById(req: Request<{ id: string }>, res: Response) {
  const user = await userService.getPublicById(req.params.id)
  if (!user) throw new HttpError(404, 'USER_NOT_FOUND', `User ${req.params.id} not found`)
  res.json(user)
}
