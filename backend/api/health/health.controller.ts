import type { Request, Response } from 'express'
import { mongoService } from '../../services/mongodb.service.ts'

// Render's health check: a deploy switches traffic only after the new instance answers 200,
// and a running instance that keeps failing it gets restarted. It pings Mongo, so "up" means
// the app can serve data, not only that the process is alive.
// Not an ApiErrorBody on failure: the caller is the host, not the FE, so it stays out of the
// shared error codes. The cause goes to the log instead
export async function getHealth(req: Request, res: Response) {
  try {
    const db = await mongoService.connect()
    await db.command({ ping: 1 })
    res.json({ status: 'ok' })
  } catch (err) {
    console.error('health check: Mongo ping failed', err)
    res.status(503).json({ status: 'unavailable' })
  }
}
