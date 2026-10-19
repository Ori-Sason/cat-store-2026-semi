import type { ChatMsgWithRefs } from '@cat-store/shared'
import type { PendingChatMsg } from '../../../models/chat'

// Pure list helpers for the chat log. No state, no socket: the room tracker decides when to call
// them

export function removePendingMsgs(pendingMsgs: PendingChatMsg[], clientMsgIds: Set<string>) {
  if (!pendingMsgs.some((msg) => clientMsgIds.has(msg.clientMsgId))) return pendingMsgs
  return pendingMsgs.filter((msg) => !clientMsgIds.has(msg.clientMsgId))
}

export function getNewestMsgId(newestMsgId: string | null, msgs: ChatMsgWithRefs[]): string | null {
  let newest = newestMsgId
  for (const msg of msgs) {
    if (newest === null || _compareIds(msg._id, newest) > 0) newest = msg._id
  }
  return newest
}

// Dedupes by _id and keeps the list in _id order: insert, never append. Two sends at the same
// moment each await their insert, so B's broadcast can arrive before A's. ObjectIds of one
// server only go up, so _id order is the order the ids were generated, close enough for display
export function mergeMsgs(
  heldMsgs: ChatMsgWithRefs[],
  newMsgs: ChatMsgWithRefs[],
): ChatMsgWithRefs[] {
  const msgById = new Map(heldMsgs.map((msg) => [msg._id, msg]))
  for (const msg of newMsgs) {
    const heldMsg = msgById.get(msg._id)
    if (!heldMsg || _isNewerCopy(msg, heldMsg)) msgById.set(msg._id, msg)
  }
  return [...msgById.values()].sort((a, b) => _compareIds(a._id, b._id))
}

// The held list itself when nothing changed, so React skips the render
export function replaceMsg(heldMsgs: ChatMsgWithRefs[], msg: ChatMsgWithRefs): ChatMsgWithRefs[] {
  const index = heldMsgs.findIndex((heldMsg) => heldMsg._id === msg._id)
  if (index === -1 || !_isNewerCopy(msg, heldMsgs[index])) return heldMsgs
  return heldMsgs.with(index, msg)
}

export function pickNewerCopy(msg: ChatMsgWithRefs, otherMsg: ChatMsgWithRefs | undefined) {
  return otherMsg && _isNewerCopy(otherMsg, msg) ? otherMsg : msg
}

// Same-length lowercase hex, so comparing the strings compares the ids
function _compareIds(a: string, b: string) {
  if (a < b) return -1
  return a > b ? 1 : 0
}

// The same msg can arrive twice with different content: a fetch that read the DB before an edit
// can land after that edit's live event. Arrival order isn't content order, so the content
// decides:
// 1. A tombstone is final (a deleted msg can't be edited), and it must win on its own:
//    a remove doesn't touch updatedAt.
// 2. Otherwise the later updatedAt wins.
// 3. A tie keeps the held copy.
// updatedAt comes from the one server clock, and only the author edits, one ack at a time
function _isNewerCopy(incomingMsg: ChatMsgWithRefs, heldMsg: ChatMsgWithRefs) {
  if (heldMsg.isDeleted) return false
  if (incomingMsg.isDeleted) return true
  return incomingMsg.updatedAt > heldMsg.updatedAt
}
