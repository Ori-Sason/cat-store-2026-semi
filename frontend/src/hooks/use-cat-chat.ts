import {
  CHAT_JOIN,
  CHAT_LEAVE,
  CHAT_MSG_ADDED,
  type ChatMsg,
  type ChatMsgOlderPage,
  type ChatRoomInput,
} from '@cat-store/shared'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { ApiError } from '../models/api-error'
import { chatService } from '../services/chat.service'
import { errorService } from '../services/error.service'
import { socketService } from '../services/socket.service'
import { useLoggedInUserStore } from '../store/logged-in-user.store'
import { useUserMsgStore } from '../store/user-msg.store'

// idle: not opened yet. loading: the first page is on its way. error: the join or that fetch failed
export type CatChatStatus = 'idle' | 'loading' | 'ready' | 'error'

interface CatChatState {
  catId: string
  msgs: ChatMsg[] // by _id, oldest first
  status: CatChatStatus
  isOldestLoaded: boolean // the server said nothing older exists
  isLoadingOlder: boolean
  unreadCount: number // msgs from others since the panel was last open
}

// One join of one room. A new join (a cat switch, StrictMode's join → leave → join) makes a new
// session, so an async result from an old one is dropped. A rejoin on reconnect or a retry keeps
// the session and only replaces its joinPromise
interface JoinSession {
  catId: string
  joinPromise: Promise<unknown>
  // Set on the first open (and again by a retry). Resolves to the page, or null when the join or
  // the fetch failed. Never rejects
  firstPagePromise: Promise<ChatMsgOlderPage | null> | null
  // The newest _id merged so far: the reconnect gap fill's cursor. Kept here, not read off the
  // state, because a reconnect handler can run before React renders the last merge
  newestMsgId: string | null
  isLoadingOlder: boolean
}

// The server event payloads for chat:msg-added (and, later, updated / removed)
interface ChatMsgEvent {
  msg: ChatMsg
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
  // Read by the live listener, which is registered once per join and would see a stale prop
  const isOpenRef = useRef(isOpen)
  // Read by join(), which the join effect calls: navigate as a dependency would rejoin the room
  const navigate = useNavigate()
  const navigateRef = useRef(navigate)

  // A cat switch can reuse cat-details without an unmount. Resetting during render (not in an
  // effect) means the old cat's msgs never show under the new cat, not even for one frame
  if (chat.catId !== catId) setChat(_getInitialState(catId))

  // Applies an async result only while its session is still the current one, and only to that
  // cat's state
  function updateChat(session: JoinSession, update: (prev: CatChatState) => CatChatState) {
    if (sessionRef.current !== session) return
    setChat((prev) => (prev.catId === session.catId ? update(prev) : prev))
  }

  // Every msg enters the state through here, so newestMsgId never misses one
  function addMsgs(session: JoinSession, msgs: ChatMsg[]) {
    if (sessionRef.current !== session || !msgs.length) return
    session.newestMsgId = _getNewestMsgId(session.newestMsgId, msgs)
    updateChat(session, (prev) => ({ ...prev, msgs: _mergeMsgs(prev.msgs, msgs) }))
  }

  // Every join (mount, reconnect, retry) goes through here. A CAT_NOT_FOUND means the cat was
  // deleted while this page was open, e.g. while the socket was offline and missed the news.
  // The catch is also what keeps a join nobody awaits (a never-opened chat) from being an
  // unhandled rejection. Other failures surface where the join is awaited
  function join(session: JoinSession) {
    const joinPromise = socketService.emitWithAck(CHAT_JOIN, {
      catId: session.catId,
    } satisfies ChatRoomInput)
    session.joinPromise = joinPromise
    const redirectIfCatGone = async () => {
      try {
        await joinPromise
      } catch (err) {
        if (sessionRef.current !== session) return
        if (!(err instanceof ApiError) || err.code !== 'CAT_NOT_FOUND') return
        useUserMsgStore.getState().queueErrorNavigationMsg('This cat was deleted')
        void navigateRef.current('/cat', { replace: true })
      }
    }
    void redirectIfCatGone()
  }

  // Waits for the join ack, then fetches: anything sent between the two arrives live, so nothing
  // is lost. Reads joinPromise when it starts, so it waits for the latest join
  function loadFirstPage(session: JoinSession) {
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
  async function rejoin(session: JoinSession) {
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
    afterId = _getNewestMsgId(afterId, firstPage.msgs)
    try {
      await session.joinPromise
    } catch {
      return // join() already redirects on CAT_NOT_FOUND. Anything else waits for the next connect
    }
    try {
      await fillGap(session, afterId)
    } catch (err) {
      // What's on screen stays. The newer msgs show up after the next reconnect or a reload
      if (sessionRef.current === session) {
        useUserMsgStore.getState().showErrorMsg(errorService.getErrorMsg(err))
      }
    }
  }

  async function fillGap(session: JoinSession, afterId: string | null) {
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
    while (cursor && sessionRef.current === session) {
      const page = await chatService.getNewerPage(session.catId, cursor)
      addMsgs(session, page.msgs)
      cursor = page.nextAfterId
    }
  }

  useEffect(() => {
    isOpenRef.current = isOpen
    navigateRef.current = navigate
  })

  useEffect(() => {
    const session: JoinSession = {
      catId,
      joinPromise: Promise.resolve(),
      firstPagePromise: null,
      newestMsgId: null,
      isLoadingOlder: false,
    }
    sessionRef.current = session
    join(session)

    // The socket is app-wide, so an event from a room just left can still land here
    const onMsgAdded = ({ msg }: ChatMsgEvent) => {
      if (msg.catId !== session.catId) return
      addMsgs(session, [msg])
      if (isOpenRef.current || _isOwnMsg(msg)) return
      updateChat(session, (prev) => ({ ...prev, unreadCount: prev.unreadCount + 1 }))
    }
    const onConnect = () => void rejoin(session)
    socketService.on(CHAT_MSG_ADDED, onMsgAdded)
    socketService.on('connect', onConnect)

    return () => {
      sessionRef.current = null
      socketService.off(CHAT_MSG_ADDED, onMsgAdded)
      socketService.off('connect', onConnect)
      socketService.emit(CHAT_LEAVE, { catId } satisfies ChatRoomInput)
    }
  }, [catId])

  // The first open. Close / reopen only toggles the panel, so it fetches once per join.
  // Opening also clears the unread count
  useEffect(() => {
    const session = sessionRef.current
    if (!isOpen || !session) return
    updateChat(session, (prev) => (prev.unreadCount ? { ...prev, unreadCount: 0 } : prev))
    if (!session.firstPagePromise) loadFirstPage(session)
  }, [catId, isOpen])

  // The error state's button: join again, then fetch. A reconnect also retries on its own
  function retry() {
    const session = sessionRef.current
    if (!session || chat.status !== 'error') return
    join(session)
    loadFirstPage(session)
  }

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
      addMsgs(session, page.msgs)
      updateChat(session, (prev) => ({ ...prev, isOldestLoaded: page.nextBeforeId === null }))
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
    // The badge sits on the closed chat icon, so it's 0 while the panel is open
    unreadCount: isOpen ? 0 : chat.unreadCount,
    loadOlder,
    retry,
  }
}

// A guest owns nothing, and a msg whose author is gone (user: null) is nobody's own
function _isOwnMsg(msg: ChatMsg) {
  const loggedInUser = useLoggedInUserStore.getState().loggedInUser
  return !!loggedInUser && msg.user?._id === loggedInUser._id
}

function _getInitialState(catId: string): CatChatState {
  return {
    catId,
    msgs: [],
    status: 'idle',
    isOldestLoaded: false,
    isLoadingOlder: false,
    unreadCount: 0,
  }
}

// Same-length lowercase hex, so comparing the strings compares the ids
function _compareIds(a: string, b: string) {
  if (a < b) return -1
  return a > b ? 1 : 0
}

function _getNewestMsgId(newestMsgId: string | null, msgs: ChatMsg[]): string | null {
  let newest = newestMsgId
  for (const msg of msgs) {
    if (newest === null || _compareIds(msg._id, newest) > 0) newest = msg._id
  }
  return newest
}

// Dedupes by _id and keeps the list in _id order: insert, never append. Two sends at the same
// moment each await their insert, so B's broadcast can arrive before A's. ObjectIds of one
// server only go up, so _id order is the order the ids were generated, close enough for display
function _mergeMsgs(heldMsgs: ChatMsg[], newMsgs: ChatMsg[]): ChatMsg[] {
  const msgById = new Map(heldMsgs.map((msg) => [msg._id, msg]))
  for (const msg of newMsgs) msgById.set(msg._id, msg)
  return [...msgById.values()].sort((a, b) => _compareIds(a._id, b._id))
}
