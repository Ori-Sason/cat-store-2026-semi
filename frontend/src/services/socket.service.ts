import { io } from 'socket.io-client'
import { ApiError } from '../models/api-error'
import { useLoggedInUserStore } from '../store/logged-in-user.store'
import { errorService } from './error.service'

// The server's DB write is awaited before the ack (~ms), so 5s means the connection is the problem
const ACK_TIMEOUT_MS = 5_000

// One socket for the whole app: the cat chat joins rooms on it, and site-wide notifications
// (roadmap Part 6 item 2) need it on every page.
// No URL: it connects to the page's own origin, and Vite proxies /socket.io to Express in dev
// (vite.config.ts). The handshake carries the loginToken cookie on its own, since it's same-origin.
// autoConnect is off so importing this module (e.g. in a test) never opens a connection
const _socket = io({ autoConnect: false })

type LoggedInUserState = ReturnType<typeof useLoggedInUserStore.getState>

export const socketService = {
  connect,
  emit,
  emitWithAck,
}

// Called once in main.tsx, after the logged-in user is loaded, so the handshake sends the
// cookie /me just checked. The handshake is the only time the server reads the cookie
function connect(): void {
  _socket.connect()
  // Subscribed only now, so loading the user in main.tsx doesn't count as a change
  useLoggedInUserStore.subscribe(_reconnectOnUserChange)
}

// The server knows the socket's user only from its handshake, so after a login, a logout or
// clearLoggedInUser() (a 401), the socket would keep acting as the old user. A new connection
// sends a new handshake with the current cookie.
// Compared by _id because the subscription fires on every set(): setting the same user again
// (e.g. a re-hydrate from /me) shouldn't drop the connection and its rooms
function _reconnectOnUserChange(state: LoggedInUserState, prevState: LoggedInUserState): void {
  const userId = state.loggedInUser?._id ?? null
  const prevUserId = prevState.loggedInUser?._id ?? null
  if (userId === prevUserId) return
  _socket.disconnect().connect()
}

// For events with no ack (chat:leave, chat:typing)
function emit(event: string, payload: unknown): void {
  _socket.emit(event, payload)
}

// Resolves with the ack, or throws an ApiError like http.service: an error ack keeps its code, and
// a timeout or a lost connection is NETWORK_ERROR.
// No client retries / ackTimeout options: they resend on their own, and stacked on a manual retry
// the attempts multiply. A failed call stays failed, and the caller decides about a retry
async function emitWithAck<T>(event: string, payload: unknown): Promise<T> {
  let ack: unknown
  try {
    ack = await _socket.timeout(ACK_TIMEOUT_MS).emitWithAck(event, payload)
  } catch (err) {
    throw new ApiError(0, 'NETWORK_ERROR', err instanceof Error ? err.message : String(err))
  }
  const error = (ack as { error?: unknown } | null)?.error
  if (error === undefined) return ack as T
  if (!errorService.isApiErrorBody(error))
    throw new ApiError(0, 'UNKNOWN', `Unexpected ${event} ack`)
  throw new ApiError(0, error.code, error.message, error.fieldErrors, error.requestId)
}
