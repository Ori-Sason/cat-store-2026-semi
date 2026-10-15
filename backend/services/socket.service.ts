import type { Server as HttpServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import cookieParser from 'cookie-parser'
import { Server } from 'socket.io'
import { authService } from '../api/auth/auth.service.ts'
import { registerChatSocketRoutes } from '../api/chat/chat.socket-routes.ts'
import { LOGIN_TOKEN_COOKIE } from '../models/auth.ts'
import type { AppServer, AppSocket, SocketEvent, SocketMiddleware } from '../models/socket.ts'
import { alsService, type AlsStore } from './als.service.ts'
import { errorService } from './error.service.ts'

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
  // Every event's chain is declared in its *.socket-routes.ts, like an Express router
  newIo.on('connection', (socket) => {
    registerChatSocketRoutes(socket)
  })

  io = newIo
  return newIo
}

// For code that only runs inside a socket event, where io always exists
function getIo(): AppServer {
  if (!io) throw new Error('No io - socketService.setup has not run')
  return io
}

// One room per cat. catId must already be lowercased (the chat schemas do it, or toHexString()),
// since room names compare as strings: cat:ABC… and cat:abc… would be two rooms
function getCatRoomName(catId: string): string {
  return `cat:${catId}`
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

// Binds one event on one socket to its chain, like an Express route with its middlewares:
//   on(socket, CHAT_MSG_ADD, validatePayload(chatMsgSchema), requireSocketUser, controller.addMsg)
// Each event runs in its own ALS store (setup-als never runs outside Express), so services read
// alsService.getVerifiedUser() the same way as on HTTP.
// The ack is optional: Socket.io passes one only when the client asks for it, and anyone can
// emit with no ack from devtools. Calling a missing ack in the error path would throw inside it,
// an unhandled rejection that crashes Node. So on() answers only when an ack exists, and wraps
// everything, its own error path included, in a try/catch that logs.
// Not socket.use((packet, next) => …): its next(err) fires a generic "error" event on the client
// instead of the ack, so emitWithAck would wait out its timeout for what's really an auth error
function on(socket: AppSocket, eventName: string, ...chain: SocketMiddleware<any>[]): void {
  socket.on(eventName, async (...args: unknown[]) => {
    // socket.emit(name, cb) puts the callback where the payload goes, so the ack is the last
    // argument only if it's a function, and the payload is whatever comes before it
    const ack = typeof args.at(-1) === 'function' ? (args.pop() as (body: unknown) => void) : null
    const store: AlsStore = {
      requestId: randomUUID(),
      socketId: socket.id,
      tokenUser: socket.data.tokenUser,
      verifiedUser: null,
    }

    await alsService.run(store, async () => {
      try {
        const event: SocketEvent = { socket, payload: args[0] }
        let ackBody: unknown
        for (const step of chain) ackBody = await step(event)
        ack?.(ackBody ?? {})
      } catch (err) {
        _answerError(err, eventName, store, ack)
      }
    })
  })
}

// Logs like errorHandler (4xx: one warn line, 5xx: the stack), then acks { error } if the client
// asked for an ack. Never throws: it's the last stop of an event's error path
function _answerError(
  err: unknown,
  eventName: string,
  { requestId, socketId }: AlsStore,
  ack: ((body: unknown) => void) | null,
): void {
  try {
    const { status, body } = errorService.toErrorResponse(err)
    const logLine = `[${requestId}] [ws socket=${socketId}] ${eventName} -> ${status} ${body.code}`
    if (status >= 500) {
      console.error(logLine)
      console.error(err)
    } else {
      console.warn(`${logLine}: ${body.message}`)
    }
    ack?.({ error: { ...body, requestId } })
  } catch (answerErr) {
    console.error(
      `[${requestId}] [ws socket=${socketId}] ${eventName}: failed to answer`,
      answerErr,
    )
  }
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

export const socketService = {
  setup,
  getIo,
  on,
  getCatRoomName,
  emit,
  close,
}
