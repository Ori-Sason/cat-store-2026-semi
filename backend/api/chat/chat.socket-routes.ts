import { CHAT_JOIN, CHAT_LEAVE, chatRoomSchema } from '@cat-store/shared'
import { validatePayload } from '../../middlewares/socket/validate-payload.socket-middleware.ts'
import type { AppSocket } from '../../models/socket.ts'
import { socketService } from '../../services/socket.service.ts'
import { chatSocketController } from './chat.socket-controller.ts'

// Every chat event's chain in one place, like chat.routes.ts for REST. Called once per socket,
// on connection. Join and leave need no user: guests read the chat too
export function registerChatSocketRoutes(socket: AppSocket): void {
  socketService.on(socket, CHAT_JOIN, validatePayload(chatRoomSchema), chatSocketController.join)
  socketService.on(socket, CHAT_LEAVE, validatePayload(chatRoomSchema), chatSocketController.leave)
}
