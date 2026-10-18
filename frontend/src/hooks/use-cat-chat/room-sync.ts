import { CHAT_JOIN, type ChatRoomInput } from '@cat-store/shared'
import { ApiError } from '../../models/api-error'
import { chatService } from '../../services/chat.service'
import { errorService } from '../../services/error.service'
import { socketService } from '../../services/socket.service'
import { useUserMsgStore } from '../../store/user-msg.store'
import { addMsgs, type JoinSession, updateChat } from './join-session'
import { getNewestMsgId } from './msg-merge'

// Keeping the log in step with the room: the join, the first page, the reconnect and "load older"

// Every join (mount, reconnect, retry) goes through here. A CAT_NOT_FOUND means the cat was
// deleted while this page was open, e.g. while the socket was offline and missed the news.
// The catch is also what keeps a join nobody awaits (a never-opened chat) from being an
// unhandled rejection. Other failures surface where the join is awaited
export function join(session: JoinSession) {
  const joinPromise = socketService.emitWithAck(CHAT_JOIN, {
    catId: session.catId,
  } satisfies ChatRoomInput)
  session.joinPromise = joinPromise
  const redirectIfCatGone = async () => {
    try {
      await joinPromise
    } catch (err) {
      if (!session.isActive) return
      if (!(err instanceof ApiError) || err.code !== 'CAT_NOT_FOUND') return
      session.onCatGone()
    }
  }
  void redirectIfCatGone()
}

// Waits for the join ack, then fetches: anything sent between the two arrives live, so nothing
// is lost. Reads joinPromise when it starts, so it waits for the latest join
export function loadFirstPage(session: JoinSession) {
  const load = async () => {
    updateChat(session, (prev) => ({ ...prev, status: 'loading' }))
    try {
      await session.joinPromise
      const page = await chatService.getOlderPage(session.catId)
      addMsgs(session, page.msgs)
      updateChat(session, (prev) => ({
        ...prev,
        status: 'ready',
        isOldestLoaded: page.nextBeforeId === null,
      }))
      return page
    } catch {
      updateChat(session, (prev) => ({ ...prev, status: 'error' }))
      return null
    }
  }
  session.firstPagePromise = load()
}

// Socket.io drops room membership with the connection, so every reconnect rejoins. Then, after
// the ack, it fills the gap forward: fill before the rejoin lands, and a msg saved between the
// two is in neither. Edits and removes of older msgs during the drop are missed until a reload
export async function rejoin(session: JoinSession) {
  // Taken before the rejoin: live msgs after it would move the cursor past the gap
  let afterId = session.newestMsgId
  join(session)
  const firstPagePromise = session.firstPagePromise
  if (!firstPagePromise) return // never opened: the first open waits for this join

  const firstPage = await firstPagePromise
  if (!firstPage) {
    // The first open failed, often from this same drop: retry it, unless a retry already did
    if (session.firstPagePromise === firstPagePromise) loadFirstPage(session)
    return
  }
  // A first page still in flight at the drop can reach past the cursor taken above
  afterId = getNewestMsgId(afterId, firstPage.msgs)
  try {
    await session.joinPromise
  } catch {
    return // join() already redirects on CAT_NOT_FOUND. Anything else waits for the next connect
  }
  try {
    await _fillGap(session, afterId)
  } catch (err) {
    // What's on screen stays. The newer msgs show up after the next reconnect or a reload
    if (session.isActive) useUserMsgStore.getState().showErrorMsg(errorService.getErrorMsg(err))
  }
}

// The cursor is the oldest _id the hook holds, not the server's last nextBeforeId: once live
// events merge in, the held msgs can reach further back than the fetched pages alone
export async function loadOlderPage(session: JoinSession, beforeId: string) {
  updateChat(session, (prev) => ({ ...prev, isLoadingOlder: true }))
  try {
    const page = await chatService.getOlderPage(session.catId, beforeId)
    addMsgs(session, page.msgs)
    updateChat(session, (prev) => ({ ...prev, isOldestLoaded: page.nextBeforeId === null }))
  } catch (err) {
    if (session.isActive) useUserMsgStore.getState().showErrorMsg(errorService.getErrorMsg(err))
  } finally {
    updateChat(session, (prev) => ({ ...prev, isLoadingOlder: false }))
  }
}

async function _fillGap(session: JoinSession, afterId: string | null) {
  if (!afterId) {
    // The log was empty when opened. The newest page holds everything the drop missed, and its
    // cursor is right, since nothing was held before it
    const page = await chatService.getOlderPage(session.catId)
    addMsgs(session, page.msgs)
    updateChat(session, (prev) => ({ ...prev, isOldestLoaded: page.nextBeforeId === null }))
    return
  }
  // Page by page until the newest: more than one page can arrive during a long drop, and
  // nothing already held is refetched, so there's no hole in the middle
  let cursor: string | null = afterId
  while (cursor && session.isActive) {
    const page = await chatService.getNewerPage(session.catId, cursor)
    addMsgs(session, page.msgs)
    cursor = page.nextAfterId
  }
}
