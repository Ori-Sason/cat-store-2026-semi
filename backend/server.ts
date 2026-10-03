import { createServer } from 'node:http'

import { app } from './app.ts'
import { mongoService } from './services/mongodb.service.ts'

const http = createServer(app)

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
