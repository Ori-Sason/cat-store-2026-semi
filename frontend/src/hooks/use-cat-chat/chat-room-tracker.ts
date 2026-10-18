import type { ChatMsg, ChatMsgOlderPage } from '@cat-store/shared'
import type { Dispatch, SetStateAction } from 'react'
import type { CatChatState } from './chat-state'
import {
  getNewestMsgId,
  mergeMsgs,
  pickNewerCopy,
  removePendingMsgs,
  replaceMsg,
} from './chat-log.util'

// One join of one room. A new join (a cat switch, StrictMode's join → leave → join) makes a new
// tracker, so an async result from an old one is dropped. A rejoin on reconnect or a retry keeps
// the tracker and only replaces its joinPromise.
// The tracker also carries what async code needs from the hook (the state setter, the redirect),
// so the parts of the chat can live outside the hook as plain functions
export interface ChatRoomTracker {
  catId: string
  // False once the join effect cleans up. Every async result checks it before touching the state
  isActive: boolean
  setChat: Dispatch<SetStateAction<CatChatState>>
  // A join found the cat deleted. The hook owns navigate, so it decides where to go
  onCatGone: () => void
  joinPromise: Promise<unknown>
  // Set on the first open (and again by a retry). Resolves to the page, or null when the join or
  // the fetch failed. Never rejects
  firstPagePromise: Promise<ChatMsgOlderPage | null> | null
  // The newest _id merged so far: the reconnect gap fill's cursor. Kept here, not read off the
  // state, because a reconnect handler can run before React renders the last merge
  newestMsgId: string | null
  // The latest copy of every msg an edit or a remove changed during this join, held or not. A
  // fetch that read the DB before the change can land after it, and this copy wins over the
  // fetched one
  changedMsgById: Map<string, ChatMsg>
}

export function createChatRoomTracker(
  catId: string,
  setChat: ChatRoomTracker['setChat'],
  onCatGone: ChatRoomTracker['onCatGone'],
): ChatRoomTracker {
  return {
    catId,
    isActive: true,
    setChat,
    onCatGone,
    joinPromise: Promise.resolve(),
    firstPagePromise: null,
    newestMsgId: null,
    changedMsgById: new Map(),
  }
}

// Applies an async result only while its tracker is still the current one, and only to that
// cat's state
export function updateChat(
  roomTracker: ChatRoomTracker,
  update: (prev: CatChatState) => CatChatState,
) {
  if (!roomTracker.isActive) return
  roomTracker.setChat((prev) => (prev.catId === roomTracker.catId ? update(prev) : prev))
}

// Every new msg enters the state through here (changes to held ones go through changeMsg), so
// newestMsgId never misses one. A saved msg also replaces its pending copy, whichever path
// brings it: the ack, the broadcast, or a gap fill (a send that failed on a lost connection may
// have been saved before the drop). A copy older than a change seen live is swapped for it
export function addMsgs(roomTracker: ChatRoomTracker, msgs: ChatMsg[]) {
  if (!roomTracker.isActive || !msgs.length) return
  roomTracker.newestMsgId = getNewestMsgId(roomTracker.newestMsgId, msgs)
  const clientMsgIds = new Set(msgs.map((msg) => msg.clientMsgId))
  const freshMsgs = msgs.map((msg) => pickNewerCopy(msg, roomTracker.changedMsgById.get(msg._id)))
  updateChat(roomTracker, (prev) => ({
    ...prev,
    msgs: mergeMsgs(prev.msgs, freshMsgs),
    pendingMsgs: removePendingMsgs(prev.pendingMsgs, clientMsgIds),
  }))
}

// An edit or a remove, from its broadcast or its ack. Unlike addMsgs, it only replaces a msg
// the log already holds. An old msg the log hasn't loaded would otherwise sit alone above a
// gap, and "load older" pages from the oldest held _id, so it would skip every msg in between.
// The copy is kept for the fetch that brings that msg later
export function changeMsg(roomTracker: ChatRoomTracker, msg: ChatMsg) {
  if (!roomTracker.isActive) return
  roomTracker.changedMsgById.set(
    msg._id,
    pickNewerCopy(msg, roomTracker.changedMsgById.get(msg._id)),
  )
  updateChat(roomTracker, (prev) => ({ ...prev, msgs: replaceMsg(prev.msgs, msg) }))
}
