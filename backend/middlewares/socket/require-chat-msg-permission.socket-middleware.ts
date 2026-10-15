import type { LoggedInUserOrGuest } from '@cat-store/shared'
import { chatService } from '../../api/chat/chat.service.ts'
import { HttpError } from '../../models/http-error.ts'
import type { SocketMiddleware } from '../../models/socket.ts'
import { alsService } from '../../services/als.service.ts'

type ChatMsgPermissionCheck = (msgUserId: string, loggedInUser: LoggedInUserOrGuest) => boolean

// The socket version of requireReviewOwner. Takes the rule as an argument, because edit and
// remove differ (chatPermissionService: author only vs author or admin).
// chatService.getByIdAndRoom throws CHAT_MSG_NOT_FOUND for a missing msg or one in another room,
// before the check, so it never shows up as a 403. The msg isn't handed on: the service's write
// re-reads it by filter, which is what keeps that write atomic.
// Mount after requireSocketUser (it reads the verified user) and requireRoomMember
export function requireChatMsgPermission(
  check: ChatMsgPermissionCheck,
): SocketMiddleware<{ catId: string; msgId: string }> {
  return async ({ payload }) => {
    const msg = await chatService.getByIdAndRoom(payload.msgId, payload.catId)
    if (!check(msg.userId.toHexString(), alsService.getVerifiedUser())) {
      throw new HttpError(403, 'FORBIDDEN', `Chat msg ${payload.msgId} isn't yours to change`)
    }
  }
}
