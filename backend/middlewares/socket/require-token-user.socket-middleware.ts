import { HttpError } from '../../models/http-error.ts'
import type { SocketMiddleware } from '../../models/socket.ts'
import { socketService } from '../../services/socket.service.ts'

// Lets through a logged-in socket whose token hasn't expired since the handshake. Token-only,
// no DB read: for typing, which is frequent, and where a stale name for a few seconds is harmless.
// Writes use requireSocketUser, which re-reads the user.
// Rejects the event, never disconnects the socket: after a server-side disconnect the client
// doesn't reconnect by itself, and the user would be left with a dead socket
export const requireTokenUser: SocketMiddleware = ({ socket }) => {
  if (!socketService.getLiveTokenUser(socket)) {
    throw new HttpError(401, 'UNAUTHORIZED', 'Log in to do this')
  }
}
