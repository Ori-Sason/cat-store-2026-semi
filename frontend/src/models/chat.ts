import type { ChatMsg, UserRef } from '@cat-store/shared'

// An own msg the server hasn't confirmed yet: shown at once (the optimistic send), matched to the
// saved msg by clientMsgId, since it has no _id yet. sending: the ack is on its way. failed: a
// timeout or an error ack, tap to retry with the same clientMsgId. user is the sender, so never
// null
export type PendingChatMsg = Omit<Extract<ChatMsg, { isDeleted: false }>, '_id' | 'user'> & {
  user: UserRef
  sendStatus: 'sending' | 'failed'
}
