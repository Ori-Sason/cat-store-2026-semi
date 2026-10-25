import { randomUUID } from 'node:crypto'
import type { LoggedInUser, UserRef } from '@cat-store/shared'
import type { AppServer, AppSocket, SocketEvent, SocketMiddleware } from '../../models/socket.ts'
import { alsService, type AlsStore } from '../als.service.ts'
import { errorService } from '../error.service.ts'

// What every socket feature uses: the io holder, the event chain (on), room names and live
// users. It imports no feature code, so chat's routes and controllers can import it with no
// cycle. Attaching io to the server and registering the features is socket-setup.service.ts

const _CAT_ROOM_PREFIX = 'cat:'

// The one io instance, so REST controllers can emit too (e.g. a site-wide "cat removed").
// null until setup runs: Supertest uses the app with no http server, so no io
let io: AppServer | null = null

// Set by socketSetupService: setup sets it, close clears it. Don't call it anywhere else: a
// swapped or cleared io would cut every socket feature off from the live server.
// It's public only because the holder must live here, where chat can import it with no cycle
function setIo(newIo: AppServer | null): void {
  io = newIo
}

function hasIo(): boolean {
  return io !== null
}

// For code that only runs inside a socket event, where io always exists
function getIo(): AppServer {
  if (!io) throw new Error('No io - socketSetupService.setup has not run')
  return io
}

// One room per cat. catId must already be lowercased (the chat schemas do it, or toHexString()),
// since room names compare as strings: cat:ABC… and cat:abc… would be two rooms
function getCatRoomName(catId: string): string {
  return `${_CAT_ROOM_PREFIX}${catId}`
}

// The reverse of getCatRoomName: cat:<id> → id, any other room → null. Every socket also sits in
// a room named after its own id, so room-level listeners use this to keep only cat rooms
function getCatIdFromRoomName(room: string): string | null {
  return room.startsWith(_CAT_ROOM_PREFIX) ? room.slice(_CAT_ROOM_PREFIX.length) : null
}

// The socket's handshake user while its token is still valid, else null: a guest, or a token
// that expired since the handshake (a socket can outlive its token). Token-only, no DB read.
// exp is in seconds (JWT)
function getLiveTokenUser(socket: AppSocket): LoggedInUser | null {
  const { tokenUser, tokenExp } = socket.data
  if (!tokenUser || tokenExp === null || tokenExp <= Date.now() / 1000) return null
  return tokenUser
}

// The distinct logged-in users among the sockets, in the order given. Deduped by _id, so one user
// in two tabs counts once. A guest, or a socket whose token expired since the handshake, isn't a
// user here (getLiveTokenUser). Picked field by field, so username never goes out
function getDistinctLiveUsers(sockets: AppSocket[]): UserRef[] {
  const userById = new Map<string, UserRef>()
  for (const socket of sockets) {
    const tokenUser = getLiveTokenUser(socket)
    if (!tokenUser || userById.has(tokenUser._id)) continue
    const { _id, fullname, isAdmin } = tokenUser
    userById.set(_id, { _id, fullname, isAdmin })
  }
  return [...userById.values()]
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

export const socketService = {
  setIo,
  hasIo,
  getIo,
  on,
  getCatRoomName,
  getCatIdFromRoomName,
  getLiveTokenUser,
  getDistinctLiveUsers,
}
