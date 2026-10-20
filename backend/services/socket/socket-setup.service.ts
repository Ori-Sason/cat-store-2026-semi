import type { Server as HttpServer } from 'node:http'
import cookieParser from 'cookie-parser'
import { Server } from 'socket.io'
import { authService } from '../../api/auth/auth.service.ts'
import {
  registerChatRoomEvents,
  registerChatSocketRoutes,
} from '../../api/chat/chat.socket-routes.ts'
import { LOGIN_TOKEN_COOKIE } from '../../models/auth.ts'
import type { AppServer, AppSocket } from '../../models/socket.ts'
import { socketService } from './socket.service.ts'

// The socket server's lifecycle: attach io, authenticate the handshake, register each feature's
// socket routes, and close. The one socket file that imports feature code, like app.ts mounts the
// Express routers. Nothing imports it but server.ts and the socket test helper, so no cycle

// Default 1MB. Zod caps a chat msg's text, but without this one frame could still be 1MB.
// 16KB leaves room for 1000 chars × 4 bytes (UTF-8) plus the JSON around them
const _MAX_HTTP_BUFFER_SIZE_BYTES = 16 * 1024

export const socketSetupService = {
  setup,
  close,
}

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
  // Room-level listeners (the adapter's join-room / leave-room), once per server, not per socket
  registerChatRoomEvents(newIo)
  // Every event's chain is declared in its *.socket-routes.ts, like an Express router
  newIo.on('connection', (socket) => {
    registerChatSocketRoutes(socket)
  })

  socketService.setIo(newIo)
  return newIo
}

// io.close() disconnects every socket, then closes the http server itself, and resolves once
// it's closed.
// So it replaces http.close(), not sits next to it: a second http.close() gets
// ERR_SERVER_NOT_RUNNING, and http.close() alone would wait on open WebSockets forever.
// It sends no DISCONNECT packet, so clients see "transport close" and keep auto-reconnecting.
// Resets the holder too, so a later emit in the same test file takes the no-op path.
// The holder is cleared before the await, so a chat write still in flight during shutdown saves
// to the DB, then fails on getIo() and logs a 500 with no broadcast. The msg isn't lost: clients
// reconnect to the new instance and the gap fill brings it
async function close(): Promise<void> {
  if (!socketService.hasIo()) return
  const oldIo = socketService.getIo()
  socketService.setIo(null)
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
  socket.data.wantedCatIds = new Set()
  next()
}
