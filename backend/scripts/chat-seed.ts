import { randomUUID } from 'node:crypto'
import { ObjectId } from 'mongodb'
import { chatMsgSchema } from '@cat-store/shared'
import type { ChatMsgDoc } from '../models/chat.ts'

// One conversation from data/chat-threads.json. `speaker` is a slot inside the thread, not a user:
// the planner fills each slot with a distinct user (or the ghost, a user who got deleted), so nobody answers themselves.
// Threads repeat across cats, so a line never names the cat, its owner or its gender
export interface ChatThreadLine {
  speaker: number
  text: string
}

export interface ChatThread {
  lines: ChatThreadLine[]
}

// One plain msg. The planner owns the times and the states: it passes createdAt and applies an
// edit or a delete on the returned doc. Validates with the shared schema, so a bad line in
// chat-threads.json fails here instead of landing in the DB.
// `_id` is made here, so call it oldest first: ids from one process grow with each call, and
// history pages by `_id` while the UI shows createdAt. clientMsgId comes from Node's
// randomUUID: the browser's secure-context limit doesn't apply here
export function buildSeedChatMsg(
  text: string,
  catId: ObjectId,
  userId: ObjectId,
  createdAt: number,
): ChatMsgDoc {
  const input = chatMsgSchema.parse({
    catId: catId.toHexString(),
    clientMsgId: randomUUID(),
    text,
  })
  return {
    _id: new ObjectId(),
    catId,
    userId,
    clientMsgId: input.clientMsgId,
    text: input.text,
    isDeleted: false,
    createdAt,
    updatedAt: createdAt,
  }
}
