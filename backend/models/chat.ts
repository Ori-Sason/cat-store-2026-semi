import type { ObjectId } from 'mongodb'
import type { ChatMsgWithRefs } from '@cat-store/shared'
import type { UserRefDoc } from './user.ts'

export const CHAT_MSG_COLLECTION = 'chatMsgs'

// The stored msg. Flat, not the wire union: a deleted msg keeps its text in the DB, so an admin
// can check what a disputed msg said. The wire mapper drops it.
// Omit on the union keeps only the keys both variants share, isDeleted as a plain boolean
export interface ChatMsgDoc extends Omit<ChatMsgWithRefs, '_id' | 'catId' | 'user'> {
  _id: ObjectId
  catId: ObjectId
  userId: ObjectId // the author - stays set after the account is gone
  text: string
}

// The aggregation output behind every ChatMsgWithRefs: userId replaced by the author's ref, or null when
// the account is gone (a left join, unlike reviews). aggregate<T>() only asserts it, so the
// route tests pin the real keys
export interface ChatMsgJoinedDoc extends Omit<ChatMsgDoc, 'userId'> {
  user: UserRefDoc | null
}
