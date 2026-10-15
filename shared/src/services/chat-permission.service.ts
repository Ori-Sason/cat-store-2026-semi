import type { LoggedInUserOrGuest } from '../models/user.ts'

// The chat msg rules. The FE uses them to decide which Edit / Delete options to show. The BE
// enforces them through requireChatMsgPermission, on a verified user.
// Both take the author's id alone, so each caller passes it from its own shape: a ChatMsgDoc's
// userId, or a ChatMsg's user?._id. null is an author whose account is gone (user: null on the
// wire). Only the FE passes null: the BE passes the doc's userId, which stays set after the
// account is gone, and no user matches it, so the result is the same

// The author only, unlike reviews: an admin rewriting someone's message would put words in
// their mouth. A gone author can't edit, so null matches no one
function canEditChatMsg(msgUserId: string | null, loggedInUser: LoggedInUserOrGuest): boolean {
  if (!loggedInUser || msgUserId === null) return false
  return msgUserId === loggedInUser._id
}

// The author or any admin: removing a message is moderation. A gone author → admin only
function canRemoveChatMsg(msgUserId: string | null, loggedInUser: LoggedInUserOrGuest): boolean {
  if (!loggedInUser) return false
  return loggedInUser.isAdmin || msgUserId === loggedInUser._id
}

export const chatPermissionService = {
  canEditChatMsg,
  canRemoveChatMsg,
}
