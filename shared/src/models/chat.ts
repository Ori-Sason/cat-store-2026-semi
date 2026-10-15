import { z } from 'zod'
import { sharedUtilService } from '../services/util.service.ts'
import type { UserRef } from './user.ts'

export const CHAT_MSG_TEXT_MAX_LENGTH = 1000

// Socket event names. Commands (client → server) are present tense, facts (server → room) are
// past tense. chat:typing is both: the client sends it and the server relays it as is
export const CHAT_JOIN = 'chat:join'
export const CHAT_LEAVE = 'chat:leave'
export const CHAT_MSG_ADD = 'chat:msg-add'
export const CHAT_MSG_UPDATE = 'chat:msg-update'
export const CHAT_MSG_REMOVE = 'chat:msg-remove'
export const CHAT_TYPING = 'chat:typing'
export const CHAT_MSG_ADDED = 'chat:msg-added'
export const CHAT_MSG_UPDATED = 'chat:msg-updated'
export const CHAT_MSG_REMOVED = 'chat:msg-removed'

// Lowercased, unlike review ids. The regex is case-insensitive, so ABC… and abc… both pass and
// find the same cat. But the room name and the FE's catId filter compare strings, so an
// uppercase id would join cat:ABC… while broadcasts go to cat:abc…
// toLowerCase is an overwrite, so it runs before the regex check
function _objectId(invalidError: string, requiredError = invalidError) {
  return z
    .string({ error: requiredError })
    .toLowerCase()
    .regex(sharedUtilService.getObjectIdRegex(), { error: invalidError })
}

const _catId = _objectId('Invalid cat', 'Cat is required')
const _msgId = _objectId('Invalid message', 'Message is required')

const _msgTxt = z
  .string({ error: 'Message is required' })
  .trim()
  .min(1, { error: 'Message is required' })
  .max(CHAT_MSG_TEXT_MAX_LENGTH, {
    error: `Message must be at most ${CHAT_MSG_TEXT_MAX_LENGTH} characters`,
  })

// A socket event has no URL (unlike REST's PUT /:id), so the ids ride in the payload: catId
// (the room) and, for edit and remove, msgId. So every event gets its own schema. userId is
// server-set and left out, so Zod strips it

// chat:msg-add. clientMsgId is the client's retry key: the server dedupes on { userId, clientMsgId }
export const chatMsgSchema = z.object({
  catId: _catId,
  clientMsgId: z.uuid({ error: 'Invalid message id' }),
  text: _msgTxt,
})

export type ChatMsgInput = z.infer<typeof chatMsgSchema>

// chat:msg-update. catId is the scope (the message must be in that room), not an updatable field
export const chatMsgUpdateSchema = z.object({
  catId: _catId,
  msgId: _msgId,
  text: _msgTxt,
})

export type ChatMsgUpdateInput = z.infer<typeof chatMsgUpdateSchema>

// chat:msg-remove
export const chatMsgRemoveSchema = chatMsgUpdateSchema.pick({ catId: true, msgId: true })

export type ChatMsgRemoveInput = z.infer<typeof chatMsgRemoveSchema>

// chat:join and chat:leave
export const chatRoomSchema = z.object({ catId: _catId })

export type ChatRoomInput = z.infer<typeof chatRoomSchema>

// chat:typing, client → server. The relay adds the sender's UserRef
export const chatTypingSchema = z.object({
  catId: _catId,
  isTyping: z.boolean({ error: 'isTyping must be true or false' }),
})

export type ChatTypingInput = z.infer<typeof chatTypingSchema>

// GET /api/cats/:id/chat-msgs. Neither → the newest page, beforeId → older, afterId → newer
// (the reconnect gap fill). Both make no sense together. A repeated query param arrives as an
// array and fails the string check
export const chatHistoryQuerySchema = z
  .object({
    beforeId: _msgId.optional(),
    afterId: _msgId.optional(),
  })
  .refine(({ beforeId, afterId }) => beforeId === undefined || afterId === undefined, {
    error: 'Use beforeId or afterId, not both',
  })

export type ChatHistoryQuery = z.infer<typeof chatHistoryQuerySchema>

// Like ReviewWithRefs, userId is replaced by the slim user (never username). user is null when the
// author's account is gone: chat keeps the message (a left join), where reviews drop it
interface ChatMsgBase {
  _id: string
  catId: string
  clientMsgId: string
  createdAt: number
  updatedAt: number // > createdAt means edited. A remove doesn't touch it
  user: UserRef | null
}

// A deleted message is a tombstone with no text, so TS won't let the FE read text off it.
// The text stays in the DB, never on the wire
export type ChatMsg =
  | (ChatMsgBase & { isDeleted: false; text: string })
  | (ChatMsgBase & { isDeleted: true })

// History pages, msgs oldest first in both directions. A cursor is null when nothing more
// exists that way
export interface ChatMsgOlderPage {
  msgs: ChatMsg[]
  nextBeforeId: string | null
}

export interface ChatMsgNewerPage {
  msgs: ChatMsg[]
  nextAfterId: string | null
}
