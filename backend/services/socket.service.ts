import type { Server as HttpServer } from 'node:http'
import cookieParser from 'cookie-parser'
import { Server } from 'socket.io'
import { authService } from '../api/auth/auth.service.ts'
import { LOGIN_TOKEN_COOKIE } from '../models/auth.ts'
import type { AppServer, AppSocket } from '../models/socket.ts'

// Default 1MB. Zod caps a chat msg's text, but without this one frame could still be 1MB.
// 16KB leaves room for 1000 chars × 4 bytes (UTF-8) plus the JSON around them
const _MAX_HTTP_BUFFER_SIZE_BYTES = 16 * 1024

// The one io instance, so REST controllers can emit too (e.g. a site-wide "cat removed").
// null until setup runs: Supertest uses the app with no http server, so no io
let io: AppServer | null = null

// Attaches Socket.io to the http server server.ts already made, so prod serves the FE, /api
// and /socket.io from one server. Never in app.ts: that's the Express app alone.
// connectionStateRecovery stays off (the default): it would restore the old socket.data user
// for up to 2 minutes without re-running the handshake. The FE rejoins and fills the gap instead
function setup(httpServer: HttpServer): AppServer {
  const newIo: AppServer = new Server(httpServer, {
    maxHttpBufferSize: _MAX_HTTP_BUFFER_SIZE_BYTES,
  })
  // The same cookie-parser REST uses. engine.use runs on every engine.io HTTP request, the
  // WebSocket upgrade included, so the handshake below sees req.cookies on either transport
  newIo.engine.use(cookieParser())
  newIo.use(_attachSocketTokenUser)

  io = newIo
  return newIo
}

// For code that only runs inside a socket event, where io always exists
function getIo(): AppServer {
  if (!io) throw new Error('No io - socketService.setup has not run')
  return io
}

// Site-wide emit for REST controllers. Does nothing until setup runs, so Supertest files need
// no change when their controllers start emitting. In prod server.ts always sets io
function emit(event: string, data: unknown): void {
  io?.emit(event, data)
}

// io.close() disconnects every socket, then closes the http server itself, and resolves once
// it's closed.
// So it replaces http.close(), not sits next to it: a second http.close() gets
// ERR_SERVER_NOT_RUNNING, and http.close() alone would wait on open WebSockets forever.
// It sends no DISCONNECT packet, so clients see "transport close" and keep auto-reconnecting.
// Resets the holder too, so a later emit in the same test file takes the no-op path
async function close(): Promise<void> {
  if (!io) return
  const oldIo = io
  io = null
  await oldIo.close()
}

// The handshake. Token-only (no DB), like attachTokenUser: requireSocketUser re-reads the user
// on writes. A missing, bad or expired token is a guest, never a rejected handshake: a guest can
// still read the chat. Same-origin, so the browser sends the cookie on its own (sameSite strict)
function _attachSocketTokenUser(socket: AppSocket, next: (err?: Error) => void): void {
  const { cookies } = socket.request as { cookies?: Record<string, string> }
  const loginToken = cookies?.[LOGIN_TOKEN_COOKIE]
  const decoded = loginToken ? authService.verifyLoginTokenWithExp(loginToken) : null

  socket.data.tokenUser = decoded?.loggedInUser ?? null
  socket.data.tokenExp = decoded?.exp ?? null
  next()
}

export const socketService = {
  setup,
  getIo,
  emit,
  close,
}
