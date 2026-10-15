import { authService } from '../../api/auth/auth.service.ts'
import { HttpError } from '../../models/http-error.ts'
import type { SocketMiddleware } from '../../models/socket.ts'
import { alsService } from '../../services/als.service.ts'
import { requireTokenUser } from './require-token-user.socket-middleware.ts'

// The socket version of requireAuth, for writes (send, edit, remove). A socket can stay open for
// hours, so the handshake user may be deleted or demoted since: re-read it from the DB and put
// it in the event's ALS store as verifiedUser, the only user permission checks and controllers
// read. Includes requireTokenUser (guest, expired token), so mount it alone
export const requireSocketUser: SocketMiddleware = async (event) => {
  requireTokenUser(event)

  const verifiedUser = await authService.getLoggedInUserById(event.socket.data.tokenUser!._id)
  if (!verifiedUser) throw new HttpError(401, 'UNAUTHORIZED', 'Log in to do this')
  alsService.getStore().verifiedUser = verifiedUser
}
