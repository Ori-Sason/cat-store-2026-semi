import { HttpError } from '../../models/http-error.ts'
import type { SocketMiddleware } from '../../models/socket.ts'
import { socketService } from '../../services/socket.service.ts'

// You can only act in a room you joined. No DB read: chat:join is the gate (it reads the cat),
// so membership means the cat existed when the socket joined. Mount after validatePayload (it
// reads the lowercased catId) and after the auth step: a guest gets 401, never 403
export const requireRoomMember: SocketMiddleware<{ catId: string }> = ({ socket, payload }) => {
  if (!socket.rooms.has(socketService.getCatRoomName(payload.catId))) {
    throw new HttpError(403, 'FORBIDDEN', `Not in the chat of cat ${payload.catId}`)
  }
}
