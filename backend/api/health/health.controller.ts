import type { Request, Response } from 'express'
import { HttpError } from '../../models/http-error.ts'
import { mongoService } from '../../services/mongodb.service.ts'

// Render's health check: a deploy switches traffic only after the new instance answers 200,
// and a running instance that keeps failing it gets restarted. It pings Mongo, so "up" means
// the app can serve data, not only that the process is alive
export async function getHealth(req: Request, res: Response) {
  try {
    await mongoService.ping()
  } catch (err) {
    const httpErr = new HttpError(503, 'SERVICE_UNAVAILABLE', 'Mongo ping failed')
    // The error middleware logs a 5xx with its stack, and Node prints the cause along with it
    httpErr.cause = err
    throw httpErr
  }
  res.json({ status: 'ok' })
}
