import {
  CHAT_JOIN,
  CHAT_LEAVE,
  CHAT_MSG_ADD,
  CHAT_MSG_REMOVE,
  CHAT_MSG_UPDATE,
  chatMsgRemoveSchema,
  chatMsgSchema,
  chatMsgUpdateSchema,
  chatPermissionService,
  chatRoomSchema,
} from '@cat-store/shared'
import { requireChatMsgPermission } from '../../middlewares/socket/require-chat-msg-permission.socket-middleware.ts'
import { requireRoomMember } from '../../middlewares/socket/require-room-member.socket-middleware.ts'
import { requireSocketUser } from '../../middlewares/socket/require-socket-user.socket-middleware.ts'
import { validatePayload } from '../../middlewares/socket/validate-payload.socket-middleware.ts'
import type { AppSocket } from '../../models/socket.ts'
import { socketService } from '../../services/socket.service.ts'
import { chatSocketController } from './chat.socket-controller.ts'

// Every chat event's chain in one place, like chat.routes.ts for REST. Called once per socket,
// on connection. Join and leave need no user: guests read the chat too.
// Auth runs before membership, like REST: a guest gets UNAUTHORIZED, never FORBIDDEN
export function registerChatSocketRoutes(socket: AppSocket): void {
  socketService.on(socket, CHAT_JOIN, validatePayload(chatRoomSchema), chatSocketController.join)
  socketService.on(socket, CHAT_LEAVE, validatePayload(chatRoomSchema), chatSocketController.leave)
  socketService.on(
    socket,
    CHAT_MSG_ADD,
    validatePayload(chatMsgSchema),
    requireSocketUser,
    requireRoomMember,
    chatSocketController.addMsg,
  )
  socketService.on(
    socket,
    CHAT_MSG_UPDATE,
    validatePayload(chatMsgUpdateSchema),
    requireSocketUser,
    requireRoomMember,
    requireChatMsgPermission(chatPermissionService.canEditChatMsg),
    chatSocketController.updateMsg,
  )
  socketService.on(
    socket,
    CHAT_MSG_REMOVE,
    validatePayload(chatMsgRemoveSchema),
    requireSocketUser,
    requireRoomMember,
    requireChatMsgPermission(chatPermissionService.canRemoveChatMsg),
    chatSocketController.removeMsg,
  )
}
