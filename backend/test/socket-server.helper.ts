import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import {
  io as ioClient,
  type ManagerOptions,
  type Socket as ClientSocket,
  type SocketOptions,
} from 'socket.io-client'
import { app } from '../app.ts'
import { socketService } from '../services/socket.service.ts'

// A real http server with io attached through the same setup server.ts uses, on a random port.
// Call it in beforeAll and close() in afterAll, only in files that need a socket.
// Why not a Vitest globalSetup? that runs in a separate context, so test files wouldn't share its socketService
export async function startSocketServer() {
  const http = createServer(app)
  socketService.setup(http)
  await new Promise<void>((resolve) => http.listen(0, resolve))
  const url = `http://localhost:${(http.address() as AddressInfo).port}`

  const clients: ClientSocket[] = []

  // A new connection per call (forceNew), sending the cookie the browser would. Resolves once
  // the handshake is done. No auto-reconnect: a test that drops a connection does it on purpose
  async function connectClient(
    cookie?: string,
    options: Partial<ManagerOptions & SocketOptions> = {},
  ): Promise<ClientSocket> {
    const client = ioClient(url, {
      forceNew: true,
      reconnection: false,
      ...(cookie ? { extraHeaders: { cookie } } : {}),
      ...options,
    })
    clients.push(client)
    await new Promise<void>((resolve, reject) => {
      client.once('connect', resolve)
      client.once('connect_error', reject)
    })
    return client
  }

  // Disconnect every client first, or an open one keeps Vitest from exiting
  async function close() {
    clients.forEach((client) => client.disconnect())
    await socketService.close()
  }

  return { url, connectClient, close }
}
