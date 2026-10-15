import { HttpError } from '../../models/http-error.ts'
import type { SocketMiddleware } from '../../models/socket.ts'

// Lets through a logged-in socket whose token hasn't expired since the handshake. Token-only,
// no DB read: for typing, which is frequent, and where a stale name for a few seconds is harmless.
// Writes use requireSocketUser, which re-reads the user.
// Rejects the event, never disconnects the socket: after a server-side disconnect the client
// doesn't reconnect by itself, and the user would be left with a dead socket
export const requireTokenUser: SocketMiddleware = ({ socket }) => {
  const { tokenUser, tokenExp } = socket.data
  // exp is in seconds (JWT)
  if (!tokenUser || tokenExp === null || tokenExp <= Date.now() / 1000) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Log in to do this')
  }
}
