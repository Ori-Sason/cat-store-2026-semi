import type { LoggedInUser } from '@cat-store/shared'
import type { DefaultEventsMap, Server, Socket } from 'socket.io'

// What the server keeps per connection (socket.data). Set once by the handshake, from the
// loginToken cookie alone (no DB), like attachTokenUser for HTTP
export interface SocketData {
  // null for a guest, or a token that's missing, bad or expired at the handshake
  tokenUser: LoggedInUser | null
  // The token's exp, in seconds (JWT). A socket can stay open past it, so each event that needs
  // a user checks it against Date.now() / 1000. null for a guest
  tokenExp: number | null
  // The cats whose chat this socket asked to join and hasn't left since. chat:join is async (it
  // reads the cat) and chat:leave isn't, so a fast cat switch can run leave A before join A
  // finishes. Join checks this after the read, so it doesn't join a room that was already left
  wantedCatIds: Set<string>
}

// Event maps stay loose: each payload is validated by its own Zod schema at the event
export type AppServer = Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>
export type AppSocket = Socket<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, SocketData>

// One event as the chain sees it. A step may replace payload (validatePayload swaps in the
// parsed one), so later steps and the controller read the validated value
export interface SocketEvent<TPayload = unknown> {
  socket: AppSocket
  payload: TPayload
}

// One step of an event's chain: a check (throws an HttpError to stop it) or the controller.
// The last step's return value is the ack body, like res.json() at the end of an Express route
export type SocketMiddleware<TPayload = unknown> = (
  event: SocketEvent<TPayload>,
) => unknown | Promise<unknown>
