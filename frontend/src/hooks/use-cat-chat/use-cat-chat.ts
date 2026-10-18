import {
  CHAT_LEAVE,
  CHAT_MSG_ADDED,
  CHAT_MSG_REMOVED,
  CHAT_MSG_UPDATED,
  type ChatMsg,
  type ChatRoomInput,
} from '@cat-store/shared'
import { useEffect, useEffectEvent, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { socketService } from '../../services/socket.service'
import { useLoggedInUserStore } from '../../store/logged-in-user.store'
import { useUserMsgStore } from '../../store/user-msg.store'
import { type ChatMsgEvent, getInitialChatState } from './chat-state'
import {
  addMsgs,
  changeMsg,
  createChatRoomTracker,
  type ChatRoomTracker,
  updateChat,
} from './chat-room-tracker'
import { emitMsgRemove, emitMsgUpdate, resendFailedMsg, sendNewMsg } from './msg-writes'
import { join, loadFirstPage, loadOlderPage, rejoin } from './room-sync'

// The cat chat on cat-details. No Zustand store: only this page uses chat.
// History doesn't come from a route loader, unlike the rest of the page's server data: it's
// fetched on the first open (a click), and live events must merge into it, which router data
// can't take.
// Join on page load, fetch on open: live events reach a closed chat too (the unread badge),
// and a visitor who never opens it pays only the join.
// This file is the React side: the state, the effects and the actions the UI calls. The work
// behind them lives next to it, as plain functions that take the room tracker
export function useCatChat(catIdParam: string, isOpen: boolean) {
  // Lowercased like the server's room name and every catId on the wire: a /cat/ABC… URL would
  // otherwise read every event as another cat's
  const catId = catIdParam.toLowerCase()
  // chat: what's drawn. React state, so a change rerenders the UI.
  // roomTrackerRef: the bookkeeping behind it. A mutable object async code reads and writes, never rendered
  const [chat, setChat] = useState(() => getInitialChatState(catId))
  const roomTrackerRef = useRef<ChatRoomTracker | null>(null)
  const navigate = useNavigate()

  // A cat switch can reuse cat-details without an unmount. Resetting during render (not in an
  // effect) means the old cat's msgs never show under the new cat, not even for one frame
  if (chat.catId !== catId) setChat(getInitialChatState(catId))

  // Effect events - call them only from effect code: passed raw into the tracker, they'd be called from outside it
  const countUnreadMsg = useEffectEvent((roomTracker: ChatRoomTracker, msg: ChatMsg) => {
    if (isOpen || _isOwnMsg(msg)) return
    updateChat(roomTracker, (prev) => ({ ...prev, unreadCount: prev.unreadCount + 1 }))
  })
  const goToCatList = useEffectEvent(() => {
    useUserMsgStore.getState().queueErrorNavigationMsg('This cat was deleted')
    void navigate('/cat', { replace: true })
  })

  useEffect(() => {
    const roomTracker = createChatRoomTracker(catId, setChat, () => goToCatList())
    roomTrackerRef.current = roomTracker
    join(roomTracker)

    // The socket is app-wide, so an event from a room just left can still land here
    const onMsgAdded = ({ msg }: ChatMsgEvent) => {
      if (msg.catId !== roomTracker.catId) return
      addMsgs(roomTracker, [msg])
      countUnreadMsg(roomTracker, msg)
    }
    // An edit or a remove isn't new, so it never counts as unread
    const onMsgChanged = ({ msg }: ChatMsgEvent) => {
      if (msg.catId !== roomTracker.catId) return
      changeMsg(roomTracker, msg)
    }
    const onConnect = () => void rejoin(roomTracker)
    socketService.on(CHAT_MSG_ADDED, onMsgAdded)
    socketService.on(CHAT_MSG_UPDATED, onMsgChanged)
    socketService.on(CHAT_MSG_REMOVED, onMsgChanged)
    socketService.on('connect', onConnect)

    return () => {
      roomTracker.isActive = false
      roomTrackerRef.current = null
      socketService.off(CHAT_MSG_ADDED, onMsgAdded)
      socketService.off(CHAT_MSG_UPDATED, onMsgChanged)
      socketService.off(CHAT_MSG_REMOVED, onMsgChanged)
      socketService.off('connect', onConnect)
      socketService.emit(CHAT_LEAVE, { catId } satisfies ChatRoomInput)
    }
  }, [catId])

  // The first open. Close / reopen only toggles the panel, so it fetches once per join.
  useEffect(() => {
    const roomTracker = roomTrackerRef.current
    if (!isOpen || !roomTracker) return
    updateChat(roomTracker, (prev) => (prev.unreadCount ? { ...prev, unreadCount: 0 } : prev))
    if (!roomTracker.firstPagePromise) loadFirstPage(roomTracker)
  }, [catId, isOpen])

  // The error state's button: join again, then fetch. A reconnect also retries on its own
  function retryLoadChat() {
    const roomTracker = roomTrackerRef.current
    if (!roomTracker || chat.status !== 'error') return
    join(roomTracker)
    loadFirstPage(roomTracker)
  }

  async function loadOlder() {
    const roomTracker = roomTrackerRef.current
    const beforeId = chat.msgs[0]?._id
    if (!roomTracker || !beforeId || chat.isOldestLoaded || chat.isLoadingOlder) return
    await loadOlderPage(roomTracker, beforeId)
  }

  function sendMsg(text: string) {
    const roomTracker = roomTrackerRef.current
    const loggedInUser = useLoggedInUserStore.getState().loggedInUser
    if (!roomTracker || !loggedInUser) return
    sendNewMsg(roomTracker, loggedInUser, text)
  }

  // Only its author can retry a failed msg: after a logout or a login as someone else, the row
  // stays as failed
  function retrySendMsg(clientMsgId: string) {
    const roomTracker = roomTrackerRef.current
    const loggedInUser = useLoggedInUserStore.getState().loggedInUser
    const pendingMsg = chat.pendingMsgs.find((msg) => msg.clientMsgId === clientMsgId)
    if (!roomTracker || !pendingMsg || pendingMsg.sendStatus !== 'failed') return
    if (pendingMsg.user._id !== loggedInUser?._id) return
    resendFailedMsg(roomTracker, pendingMsg)
  }

  // Both resolve to whether the change was saved
  function updateMsg(msgId: string, text: string) {
    const roomTracker = roomTrackerRef.current
    if (!roomTracker) return Promise.resolve(false)
    return emitMsgUpdate(roomTracker, msgId, text)
  }

  function removeMsg(msgId: string) {
    const roomTracker = roomTrackerRef.current
    if (!roomTracker) return Promise.resolve(false)
    return emitMsgRemove(roomTracker, msgId)
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

// A guest owns nothing, and a msg whose author is gone (user: null) is nobody's own
function _isOwnMsg(msg: ChatMsg) {
  const loggedInUser = useLoggedInUserStore.getState().loggedInUser
  return !!loggedInUser && msg.user?._id === loggedInUser._id
}
