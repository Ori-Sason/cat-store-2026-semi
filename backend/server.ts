import express from 'express'
import cookieParser from 'cookie-parser'
import path from 'node:path'
import { createServer } from 'node:http'

import { HttpError } from './models/http-error.ts'
import { errorHandler } from './middlewares/error.middleware.ts'
import { mongoService } from './services/mongodb.service.ts'

const app = express()
const http = createServer(app)

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(import.meta.dirname, 'public')))
} else {
  // No need to use cors anymore because of Vite proxy (see note in learning-notes/backend.md)
}

app.use(express.json())
app.use(cookieParser())

/* ROUTES */

app.use('/api', (req) => {
  throw new HttpError(
    404,
    'ROUTE_NOT_FOUND',
    `${req.method} /api${req.path} is not supported in this API`,
  )
})
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.resolve(import.meta.dirname, 'public', 'index.html'))
})
app.use(errorHandler)

// Fail fast: if Mongo is unreachable, crash on startup instead of serving 500s
await mongoService.connect()
console.log('connected to MongoDB')

const PORT = process.env.PORT || 8000
http.listen(PORT, () => {
  console.log(`server listening on ${PORT}`)
})

/* GRACEFUL SHUTDOWN */
function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`)

  // Stop accepting new connections; callback fires once in-flight requests finish
  http.close(async () => {
    await mongoService.close()
    process.exit(0)
  })

  // Safety net if some connection hangs - unref so the timer itself doesn't keep the process alive
  setTimeout(() => process.exit(1), 10_000).unref()
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
