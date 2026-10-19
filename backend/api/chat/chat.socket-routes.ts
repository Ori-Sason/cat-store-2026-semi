import {
  CHAT_JOIN,
  CHAT_LEAVE,
  CHAT_MSG_ADD,
  CHAT_MSG_REMOVE,
  CHAT_MSG_UPDATE,
  CHAT_TYPING,
  chatMsgRemoveSchema,
  chatMsgSchema,
  chatMsgUpdateSchema,
  chatPermissionService,
  chatRoomSchema,
  chatTypingSchema,
} from '@cat-store/shared'
import { requireChatMsgPermission } from '../../middlewares/socket/require-chat-msg-permission.socket-middleware.ts'
import { requireRoomMember } from '../../middlewares/socket/require-room-member.socket-middleware.ts'
import { requireSocketUser } from '../../middlewares/socket/require-socket-user.socket-middleware.ts'
import { requireTokenUser } from '../../middlewares/socket/require-token-user.socket-middleware.ts'
import { validatePayload } from '../../middlewares/socket/validate-payload.socket-middleware.ts'
import type { AppServer, AppSocket } from '../../models/socket.ts'
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
  // Token-only auth (no DB read): typing is frequent.
  // No ack: nothing is saved, so the client has nothing to wait for. A failed check (a guest, or
  // not in the room) is only logged
  socketService.on(
    socket,
    CHAT_TYPING,
    validatePayload(chatTypingSchema),
    requireTokenUser,
    requireRoomMember,
    chatSocketController.relayTyping,
  )
}

// Room-level chat events, called once per server by socketService.setup.
// Presence hooks the adapter's join-room / leave-room, not the join / leave controllers. One
// place covers all three triggers: the adapter emits join-room only when the socket wasn't in the
// room yet (a repeat join announces nothing), and leave-room after removing the socket (so the
// snapshot already leaves it out), for a chat:leave and for every room on a disconnect.
// A join cancelled by a leave never calls socket.join, so it announces nothing either.
// The adapter is per process: with a multi-node adapter (Redis), each node keeps its own rooms,
// so join-room fires only on the node the socket is on, and the snapshot would miss the other
// nodes' sockets. Fine with one instance
export function registerChatRoomEvents(io: AppServer): void {
  const { adapter } = io.sockets
  adapter.on('join-room', (room: string) => socketService.emitPresenceOnCatRoomChange(io, room))
  adapter.on('leave-room', (room: string) => socketService.emitPresenceOnCatRoomChange(io, room))
}
