import { CHAT_JOIN, type ChatRoomInput } from '@cat-store/shared'
import { ApiError } from '../../models/api-error'
import { chatService } from '../../services/chat.service'
import { errorService } from '../../services/error.service'
import { socketService } from '../../services/socket.service'
import { useUserMsgStore } from '../../store/user-msg.store'
import { addMsgs, type ChatRoomTracker, updateChat } from './chat-room-tracker'
import { getNewestMsgId } from './msg-merge'

// Keeping the log in step with the room: the join, the first page, the reconnect and "load older"

// Every join (mount, reconnect, retry) goes through here. A CAT_NOT_FOUND means the cat was
// deleted while this page was open, e.g. while the socket was offline and missed the news.
// The catch is also what keeps a join nobody awaits (a never-opened chat) from being an
// unhandled rejection. Other failures surface where the join is awaited
export function join(roomTracker: ChatRoomTracker) {
  const joinPromise = socketService.emitWithAck(CHAT_JOIN, {
    catId: roomTracker.catId,
  } satisfies ChatRoomInput)
  roomTracker.joinPromise = joinPromise
  const redirectIfCatGone = async () => {
    try {
      await joinPromise
    } catch (err) {
      if (!roomTracker.isActive) return
      if (!(err instanceof ApiError) || err.code !== 'CAT_NOT_FOUND') return
      roomTracker.onCatGone()
    }
  }
  void redirectIfCatGone()
}

// Waits for the join ack, then fetches: anything sent between the two arrives live, so nothing
// is lost. Reads joinPromise when it starts, so it waits for the latest join
export function loadFirstPage(roomTracker: ChatRoomTracker) {
  const load = async () => {
    updateChat(roomTracker, (prev) => ({ ...prev, status: 'loading' }))
    try {
      await roomTracker.joinPromise
      const page = await chatService.getOlderPage(roomTracker.catId)
      addMsgs(roomTracker, page.msgs)
      updateChat(roomTracker, (prev) => ({
        ...prev,
        status: 'ready',
        isOldestLoaded: page.nextBeforeId === null,
      }))
      return page
    } catch {
      updateChat(roomTracker, (prev) => ({ ...prev, status: 'error' }))
      return null
    }
  }
  roomTracker.firstPagePromise = load()
}

// Socket.io drops room membership with the connection, so every reconnect rejoins. Then, after
// the ack, it fills the gap forward: fill before the rejoin lands, and a msg saved between the
// two is in neither. Edits and removes of older msgs during the drop are missed until a reload
export async function rejoin(roomTracker: ChatRoomTracker) {
  // Taken before the rejoin: live msgs after it would move the cursor past the gap
  let afterId = roomTracker.newestMsgId
  join(roomTracker)
  const firstPagePromise = roomTracker.firstPagePromise
  if (!firstPagePromise) return // never opened: the first open waits for this join

  const firstPage = await firstPagePromise
  if (!firstPage) {
    // The first open failed, often from this same drop: retry it, unless a retry already did
    if (roomTracker.firstPagePromise === firstPagePromise) loadFirstPage(roomTracker)
    return
  }
  // A first page still in flight at the drop can reach past the cursor taken above
  afterId = getNewestMsgId(afterId, firstPage.msgs)
  try {
    await roomTracker.joinPromise
  } catch {
    return // join() already redirects on CAT_NOT_FOUND. Anything else waits for the next connect
  }
  try {
    await _fillGap(roomTracker, afterId)
  } catch (err) {
    // What's on screen stays. The newer msgs show up after the next reconnect or a reload
    if (roomTracker.isActive) useUserMsgStore.getState().showErrorMsg(errorService.getErrorMsg(err))
  }
}

// The cursor is the oldest _id the hook holds, not the server's last nextBeforeId: once live
// events merge in, the held msgs can reach further back than the fetched pages alone
export async function loadOlderPage(roomTracker: ChatRoomTracker, beforeId: string) {
  updateChat(roomTracker, (prev) => ({ ...prev, isLoadingOlder: true }))
  try {
    const page = await chatService.getOlderPage(roomTracker.catId, beforeId)
    addMsgs(roomTracker, page.msgs)
    updateChat(roomTracker, (prev) => ({ ...prev, isOldestLoaded: page.nextBeforeId === null }))
  } catch (err) {
    if (roomTracker.isActive) useUserMsgStore.getState().showErrorMsg(errorService.getErrorMsg(err))
  } finally {
    updateChat(roomTracker, (prev) => ({ ...prev, isLoadingOlder: false }))
  }
}

async function _fillGap(roomTracker: ChatRoomTracker, afterId: string | null) {
  if (!afterId) {
    // The log was empty when opened. The newest page holds everything the drop missed, and its
    // cursor is right, since nothing was held before it
    const page = await chatService.getOlderPage(roomTracker.catId)
    addMsgs(roomTracker, page.msgs)
    updateChat(roomTracker, (prev) => ({ ...prev, isOldestLoaded: page.nextBeforeId === null }))
    return
  }
  // Page by page until the newest: more than one page can arrive during a long drop, and
  // nothing already held is refetched, so there's no hole in the middle
  let cursor: string | null = afterId
  while (cursor && roomTracker.isActive) {
    const page = await chatService.getNewerPage(roomTracker.catId, cursor)
    addMsgs(roomTracker, page.msgs)
    cursor = page.nextAfterId
  }
}
