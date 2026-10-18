import {
  CHAT_JOIN,
  CHAT_LEAVE,
  CHAT_MSG_ADD,
  CHAT_MSG_ADDED,
  CHAT_MSG_REMOVE,
  CHAT_MSG_REMOVED,
  CHAT_MSG_UPDATE,
  CHAT_MSG_UPDATED,
  type ChatMsg,
  type ChatMsgInput,
  type ChatMsgOlderPage,
  type ChatMsgRemoveInput,
  type ChatMsgUpdateInput,
  type ChatRoomInput,
} from '@cat-store/shared'
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { ApiError } from '../models/api-error'
import type { PendingChatMsg } from '../models/chat'
import { chatService } from '../services/chat.service'
import { errorService } from '../services/error.service'
import { socketService } from '../services/socket.service'
import { utilService } from '../services/util.service'
import { useLoggedInUserStore } from '../store/logged-in-user.store'
import { useUserMsgStore } from '../store/user-msg.store'

// idle: not opened yet. loading: the first page is on its way. error: the join or that fetch failed
export type CatChatStatus = 'idle' | 'loading' | 'ready' | 'error'

// A saved msg waiting on its edit or remove ack
export type ChatMsgBusyAction = 'updating' | 'removing'

interface CatChatState {
  catId: string
  msgs: ChatMsg[] // by _id, oldest first
  pendingMsgs: PendingChatMsg[] // own sends not confirmed yet, in send order, below the msgs
  status: CatChatStatus
  isOldestLoaded: boolean // the server said nothing older exists
  isLoadingOlder: boolean
  unreadCount: number // msgs from others since the panel was last open
  busyMsgs: Partial<Record<string, ChatMsgBusyAction>> // by _id
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
  // The _ids waiting on an edit or remove ack. Also in the state for the UI, but checked here: a
  // second call can come before React renders the first one's busy state
  busyMsgIds: Set<string>
  // The latest copy of every msg an edit or a remove changed during this join, held or not. A
  // fetch that read the DB before the change can land after it, and this copy wins over the
  // fetched one
  changedMsgById: Map<string, ChatMsg>
}

// The server event payloads for chat:msg-added / updated / removed, and the acks of
// chat:msg-add / update / remove
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

  // Every new msg enters the state through here (changes to held ones go through changeMsg), so
  // newestMsgId never misses one. A saved msg also replaces its pending copy, whichever path
  // brings it: the ack, the broadcast, or a gap fill (a send that failed on a lost connection may
  // have been saved before the drop). A copy older than a change seen live is swapped for it
  function addMsgs(session: JoinSession, msgs: ChatMsg[]) {
    if (sessionRef.current !== session || !msgs.length) return
    session.newestMsgId = _getNewestMsgId(session.newestMsgId, msgs)
    const clientMsgIds = new Set(msgs.map((msg) => msg.clientMsgId))
    const freshMsgs = msgs.map((msg) => _pickNewerCopy(msg, session.changedMsgById.get(msg._id)))
    updateChat(session, (prev) => ({
      ...prev,
      msgs: _mergeMsgs(prev.msgs, freshMsgs),
      pendingMsgs: _removePendingMsgs(prev.pendingMsgs, clientMsgIds),
    }))
  }

  // An edit or a remove, from its broadcast or its ack. Unlike addMsgs, it only replaces a msg
  // the log already holds. An old msg the log hasn't loaded would otherwise sit alone above a
  // gap, and "load older" pages from the oldest held _id, so it would skip every msg in between.
  // The copy is kept for the fetch that brings that msg later
  function changeMsg(session: JoinSession, msg: ChatMsg) {
    if (sessionRef.current !== session) return
    session.changedMsgById.set(msg._id, _pickNewerCopy(msg, session.changedMsgById.get(msg._id)))
    updateChat(session, (prev) => ({ ...prev, msgs: _replaceMsg(prev.msgs, msg) }))
  }

  function setMsgBusy(session: JoinSession, msgId: string, action: ChatMsgBusyAction | null) {
    if (action) session.busyMsgIds.add(msgId)
    else session.busyMsgIds.delete(msgId)
    updateChat(session, (prev) => {
      const busyMsgs = { ...prev.busyMsgs }
      if (action) busyMsgs[msgId] = action
      else delete busyMsgs[msgId]
      return { ...prev, busyMsgs }
    })
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

  // One try of a pending msg, the first or a retry. The DB write is awaited on the server before
  // the ack, so the ack means saved. The broadcast may land first: then this ack only dedupes.
  // A failure marks it failed, unless the broadcast already saved it.
  // Only an UNAUTHORIZED logs the user out (socketService clears the user on it). A timeout or a
  // lost connection is a NETWORK_ERROR: failed, and the user stays logged in
  async function sendPendingMsg(session: JoinSession, pendingMsg: PendingChatMsg) {
    const { catId, clientMsgId, text } = pendingMsg
    try {
      const payload = { catId, clientMsgId, text }
      const { msg } = await socketService.emitWithAck<ChatMsgEvent>(
        CHAT_MSG_ADD,
        payload satisfies ChatMsgInput,
      )
      addMsgs(session, [msg])
    } catch (err) {
      updateChat(session, (prev) => ({
        ...prev,
        pendingMsgs: prev.pendingMsgs.map((prevPendingMsg) =>
          prevPendingMsg.clientMsgId === clientMsgId
            ? { ...prevPendingMsg, sendStatus: 'failed' }
            : prevPendingMsg,
        ),
      }))
      if (sessionRef.current !== session) return
      if (err instanceof ApiError && err.code === 'UNAUTHORIZED') {
        // The composer turns into the guest CTA, and logging in leaves the page: keep the text
        chatService.saveDraft(catId, text)
        _showSessionExpiredMsg()
      }
    }
  }

  // An edit or a remove. Not optimistic, unlike a send: the msg stays as it was, dimmed, until
  // the ack, and its copy then replaces the held one. A timeout or an error ack leaves the msg as
  // it was and says why. An UNAUTHORIZED needs no draft: the msg is already saved.
  // Resolves to whether it was saved, so the inline editor knows to close or to stay open
  async function emitMsgChange(
    session: JoinSession,
    msgId: string,
    action: ChatMsgBusyAction,
    emit: () => Promise<ChatMsgEvent>,
  ) {
    if (sessionRef.current !== session || session.busyMsgIds.has(msgId)) return false
    setMsgBusy(session, msgId, action)
    try {
      const { msg } = await emit()
      changeMsg(session, msg)
      return sessionRef.current === session
    } catch (err) {
      if (sessionRef.current !== session) return false
      if (err instanceof ApiError && err.code === 'UNAUTHORIZED') {
        _showSessionExpiredMsg()
      } else {
        const failedTxt = action === 'updating' ? "Couldn't save your edit." : "Couldn't delete it."
        useUserMsgStore.getState().showErrorMsg(`${failedTxt} ${errorService.getErrorMsg(err)}`)
      }
      return false
    } finally {
      setMsgBusy(session, msgId, null)
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
      busyMsgIds: new Set(),
      changedMsgById: new Map(),
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
    // An edit or a remove isn't new, so it never counts as unread
    const onMsgChanged = ({ msg }: ChatMsgEvent) => {
      if (msg.catId !== session.catId) return
      changeMsg(session, msg)
    }
    const onConnect = () => void rejoin(session)
    socketService.on(CHAT_MSG_ADDED, onMsgAdded)
    socketService.on(CHAT_MSG_UPDATED, onMsgChanged)
    socketService.on(CHAT_MSG_REMOVED, onMsgChanged)
    socketService.on('connect', onConnect)

    return () => {
      sessionRef.current = null
      socketService.off(CHAT_MSG_ADDED, onMsgAdded)
      socketService.off(CHAT_MSG_UPDATED, onMsgChanged)
      socketService.off(CHAT_MSG_REMOVED, onMsgChanged)
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
  function retryLoadChat() {
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

  // Optimistic: the msg shows at once as pending, and the ack or the broadcast replaces it with
  // the saved one. text is the composer's, already trimmed and checked
  function sendMsg(text: string) {
    const session = sessionRef.current
    const loggedInUser = useLoggedInUserStore.getState().loggedInUser
    if (!session || !loggedInUser) return
    const now = Date.now()
    const pendingMsg: PendingChatMsg = {
      catId: session.catId,
      clientMsgId: utilService.getRandomUuid(),
      createdAt: now,
      updatedAt: now,
      user: {
        _id: loggedInUser._id,
        fullname: loggedInUser.fullname,
        isAdmin: loggedInUser.isAdmin,
      },
      isDeleted: false,
      text,
      sendStatus: 'sending',
    }
    updateChat(session, (prev) => ({ ...prev, pendingMsgs: [...prev.pendingMsgs, pendingMsg] }))
    void sendPendingMsg(session, pendingMsg)
  }

  // The same clientMsgId, so a msg that was saved after all (only the ack got lost) is deduped by
  // the server, which acks the saved copy. Only its author can retry it: after a logout or a
  // login as someone else, the row stays as failed
  function retrySendMsg(clientMsgId: string) {
    const session = sessionRef.current
    const loggedInUser = useLoggedInUserStore.getState().loggedInUser
    const pendingMsg = chat.pendingMsgs.find((msg) => msg.clientMsgId === clientMsgId)
    if (!session || !pendingMsg || pendingMsg.sendStatus !== 'failed') return
    if (pendingMsg.user._id !== loggedInUser?._id) return
    const retriedMsg: PendingChatMsg = { ...pendingMsg, sendStatus: 'sending' }
    updateChat(session, (prev) => ({
      ...prev,
      pendingMsgs: prev.pendingMsgs.map((msg) =>
        msg.clientMsgId === clientMsgId ? retriedMsg : msg,
      ),
    }))
    void sendPendingMsg(session, retriedMsg)
  }

  // text is the inline editor's, already trimmed and checked. Only the author may edit: the UI
  // offers it per chatPermissionService, and the server enforces it
  function updateMsg(msgId: string, text: string) {
    const session = sessionRef.current
    if (!session) return Promise.resolve(false)
    const payload = { catId: session.catId, msgId, text } satisfies ChatMsgUpdateInput
    return emitMsgChange(session, msgId, 'updating', () =>
      socketService.emitWithAck<ChatMsgEvent>(CHAT_MSG_UPDATE, payload),
    )
  }

  // The ack is the tombstone. The author or an admin, like the edit's checks
  function removeMsg(msgId: string) {
    const session = sessionRef.current
    if (!session) return Promise.resolve(false)
    const payload = { catId: session.catId, msgId } satisfies ChatMsgRemoveInput
    return emitMsgChange(session, msgId, 'removing', () =>
      socketService.emitWithAck<ChatMsgEvent>(CHAT_MSG_REMOVE, payload),
    )
  }

  return {
    msgs: chat.msgs,
    pendingMsgs: chat.pendingMsgs,
    status: chat.status,
    isOlderAvailable: chat.status === 'ready' && !chat.isOldestLoaded && chat.msgs.length > 0,
    isLoadingOlder: chat.isLoadingOlder,
    // The badge sits on the closed chat icon, so it's 0 while the panel is open
    unreadCount: isOpen ? 0 : chat.unreadCount,
    busyMsgs: chat.busyMsgs,
    loadOlder,
    retryLoadChat,
    sendMsg,
    retrySendMsg,
    updateMsg,
    removeMsg,
  }
}

// Like a REST 401: socketService already cleared the user. No redirect: the user stays on the page
// as a guest, and can still read
function _showSessionExpiredMsg() {
  useUserMsgStore.getState().showErrorMsg('Your session expired. Log in to keep chatting.')
}

function _removePendingMsgs(pendingMsgs: PendingChatMsg[], clientMsgIds: Set<string>) {
  if (!pendingMsgs.some((msg) => clientMsgIds.has(msg.clientMsgId))) return pendingMsgs
  return pendingMsgs.filter((msg) => !clientMsgIds.has(msg.clientMsgId))
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
    pendingMsgs: [],
    status: 'idle',
    isOldestLoaded: false,
    isLoadingOlder: false,
    unreadCount: 0,
    busyMsgs: {},
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
  for (const msg of newMsgs) {
    const heldMsg = msgById.get(msg._id)
    if (!heldMsg || _isNewerCopy(msg, heldMsg)) msgById.set(msg._id, msg)
  }
  return [...msgById.values()].sort((a, b) => _compareIds(a._id, b._id))
}

// The held list itself when nothing changed, so React skips the render
function _replaceMsg(heldMsgs: ChatMsg[], msg: ChatMsg): ChatMsg[] {
  const index = heldMsgs.findIndex((heldMsg) => heldMsg._id === msg._id)
  if (index === -1 || !_isNewerCopy(msg, heldMsgs[index])) return heldMsgs
  return heldMsgs.with(index, msg)
}

function _pickNewerCopy(msg: ChatMsg, otherMsg: ChatMsg | undefined) {
  return otherMsg && _isNewerCopy(otherMsg, msg) ? otherMsg : msg
}

// The same msg can arrive twice with different content: a fetch that read the DB before an edit
// can land after that edit's live event. Arrival order isn't content order, so the content
// decides:
// 1. A tombstone is final (a deleted msg can't be edited), and it must win on its own:
//    a remove doesn't touch updatedAt.
// 2. Otherwise the later updatedAt wins.
// 3. A tie keeps the held copy.
// updatedAt comes from the one server clock, and only the author edits, one ack at a time
function _isNewerCopy(incomingMsg: ChatMsg, heldMsg: ChatMsg) {
  if (heldMsg.isDeleted) return false
  if (incomingMsg.isDeleted) return true
  return incomingMsg.updatedAt > heldMsg.updatedAt
}
