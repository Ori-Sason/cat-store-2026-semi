import { CHAT_JOIN, CHAT_LEAVE, type ChatMsg, type ChatRoomInput } from '@cat-store/shared'
import { useEffect, useRef, useState } from 'react'
import { chatService } from '../services/chat.service'
import { errorService } from '../services/error.service'
import { socketService } from '../services/socket.service'
import { utilService } from '../services/util.service'
import { useUserMsgStore } from '../store/user-msg.store'

// idle: not opened yet. loading: the first page is on its way. error: the join or that fetch failed
export type CatChatStatus = 'idle' | 'loading' | 'ready' | 'error'

interface CatChatState {
  catId: string
  msgs: ChatMsg[] // by _id, oldest first
  status: CatChatStatus
  isOldestLoaded: boolean // the server said nothing older exists
  isLoadingOlder: boolean
}

// One join of one room. A new join (a cat switch, StrictMode's join → leave → join) makes a new
// session, so an async result from an old one is dropped
interface JoinSession {
  catId: string
  joinPromise: Promise<unknown>
  isFetchStarted: boolean
  isLoadingOlder: boolean
}

// The cat chat on cat-details. No Zustand store: only this page uses chat.
// History doesn't come from a route loader, unlike the rest of the page's server data: it's
// fetched on the first open (a click), and live events must merge into it, which router data
// can't take.
// Join on page load, fetch on open: live events reach a closed chat too (the unread badge),
// and a visitor who never opens it pays only the join
export function useCatChat(catIdParam: string, isOpen: boolean) {
  // Lowercased like the server's room name and every catId on the wire: a /cat/ABC… URL would
  // otherwise read every event as another cat's
  const catId = catIdParam.toLowerCase()
  const [chat, setChat] = useState(() => _getInitialState(catId))
  const sessionRef = useRef<JoinSession | null>(null)

  // A cat switch can reuse cat-details without an unmount. Resetting during render (not in an
  // effect) means the old cat's msgs never show under the new cat, not even for one frame
  if (chat.catId !== catId) setChat(_getInitialState(catId))

  // Applies an async result only while its session is still the current one, and only to that
  // cat's state
  function updateChat(session: JoinSession, update: (prev: CatChatState) => CatChatState) {
    if (sessionRef.current !== session) return
    setChat((prev) => (prev.catId === session.catId ? update(prev) : prev))
  }

  useEffect(() => {
    const joinPromise = socketService.emitWithAck(CHAT_JOIN, { catId } satisfies ChatRoomInput)
    // Awaited only on open, so a failed join on a never-opened chat would be an unhandled rejection
    utilService.withSilentReject(joinPromise)
    sessionRef.current = { catId, joinPromise, isFetchStarted: false, isLoadingOlder: false }
    return () => {
      sessionRef.current = null
      socketService.emit(CHAT_LEAVE, { catId } satisfies ChatRoomInput)
    }
  }, [catId])

  // The first open. Waits for the join ack, then fetches: anything sent between the two arrives
  // live, so nothing is lost. Close / reopen only toggles the panel, so it fetches once per join
  useEffect(() => {
    const session = sessionRef.current
    if (!isOpen || !session || session.isFetchStarted) return
    session.isFetchStarted = true

    const loadFirstPage = async () => {
      updateChat(session, (prev) => ({ ...prev, status: 'loading' }))
      try {
        await session.joinPromise
        const page = await chatService.getOlderPage(session.catId)
        updateChat(session, (prev) => ({
          ...prev,
          msgs: _mergeMsgs(prev.msgs, page.msgs),
          status: 'ready',
          isOldestLoaded: page.nextBeforeId === null,
        }))
      } catch {
        updateChat(session, (prev) => ({ ...prev, status: 'error' }))
      }
    }
    void loadFirstPage()
  }, [catId, isOpen])

  // The cursor is the oldest _id the hook holds, not the server's last nextBeforeId: once live
  // events merge in, the held msgs can reach further back than the fetched pages alone
  async function loadOlder() {
    const session = sessionRef.current
    const beforeId = chat.msgs[0]?._id
    if (!session || !beforeId || chat.isOldestLoaded || session.isLoadingOlder) return
    session.isLoadingOlder = true
    updateChat(session, (prev) => ({ ...prev, isLoadingOlder: true }))
    try {
      const page = await chatService.getOlderPage(session.catId, beforeId)
      updateChat(session, (prev) => ({
        ...prev,
        msgs: _mergeMsgs(prev.msgs, page.msgs),
        isOldestLoaded: page.nextBeforeId === null,
      }))
    } catch (err) {
      if (sessionRef.current === session) {
        useUserMsgStore.getState().showErrorMsg(errorService.getErrorMsg(err))
      }
    } finally {
      session.isLoadingOlder = false
      updateChat(session, (prev) => ({ ...prev, isLoadingOlder: false }))
    }
  }

  return {
    msgs: chat.msgs,
    status: chat.status,
    isOlderAvailable: chat.status === 'ready' && !chat.isOldestLoaded && chat.msgs.length > 0,
    isLoadingOlder: chat.isLoadingOlder,
    loadOlder,
  }
}

function _getInitialState(catId: string): CatChatState {
  return { catId, msgs: [], status: 'idle', isOldestLoaded: false, isLoadingOlder: false }
}

// Dedupes by _id and keeps the list in _id order: insert, never append. Two sends at the same
// moment each await their insert, so B's broadcast can arrive before A's. ObjectIds of one
// server only go up, so _id order is the order the ids were generated, close enough for display.
// Same-length lowercase hex, so comparing the strings compares the ids
function _mergeMsgs(heldMsgs: ChatMsg[], newMsgs: ChatMsg[]): ChatMsg[] {
  const msgById = new Map(heldMsgs.map((msg) => [msg._id, msg]))
  for (const msg of newMsgs) msgById.set(msg._id, msg)
  return [...msgById.values()].sort((a, b) => {
    if (a._id < b._id) return -1
    return a._id > b._id ? 1 : 0
  })
}
