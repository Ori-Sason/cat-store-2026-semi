import { createServer } from 'node:http'

import { app } from './app.ts'
import { mongoService } from './services/mongodb.service.ts'
import { socketSetupService } from './services/socket/socket-setup.service.ts'

const http = createServer(app)
socketSetupService.setup(http)

// Fail fast: if Mongo is unreachable, crash on startup instead of serving 500s
await mongoService.connect()
console.log('connected to MongoDB')

const PORT = process.env.PORT || 8000
http.listen(PORT, () => {
  console.log(`server listening on ${PORT}`)
})

/* GRACEFUL SHUTDOWN */
async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down`)

  // Safety net if some connection hangs - unref so the timer itself doesn't keep the process alive
  setTimeout(() => process.exit(1), 10_000).unref()

  // Not http.close(): it would wait on the open WebSockets until the timer above kills the
  // process. socketSetupService.close() disconnects them, then closes the http server (no new
  // connections, in-flight requests finish) and resolves once it's closed
  await socketSetupService.close()
  await mongoService.close()
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
