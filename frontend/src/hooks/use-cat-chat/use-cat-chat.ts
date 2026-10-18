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
import { addMsgs, changeMsg, createJoinSession, type JoinSession, updateChat } from './join-session'
import { emitMsgRemove, emitMsgUpdate, resendFailedMsg, sendNewMsg } from './msg-writes'
import { join, loadFirstPage, loadOlderPage, rejoin } from './room-sync'

// The cat chat on cat-details. No Zustand store: only this page uses chat.
// History doesn't come from a route loader, unlike the rest of the page's server data: it's
// fetched on the first open (a click), and live events must merge into it, which router data
// can't take.
// Join on page load, fetch on open: live events reach a closed chat too (the unread badge),
// and a visitor who never opens it pays only the join.
// This file is the React side: the state, the effects and the actions the UI calls. The work
// behind them lives next to it, as plain functions that take the join session
export function useCatChat(catIdParam: string, isOpen: boolean) {
  // Lowercased like the server's room name and every catId on the wire: a /cat/ABC… URL would
  // otherwise read every event as another cat's
  const catId = catIdParam.toLowerCase()
  const [chat, setChat] = useState(() => getInitialChatState(catId))
  const sessionRef = useRef<JoinSession | null>(null)
  const navigate = useNavigate()

  // A cat switch can reuse cat-details without an unmount. Resetting during render (not in an
  // effect) means the old cat's msgs never show under the new cat, not even for one frame
  if (chat.catId !== catId) setChat(getInitialChatState(catId))

  // Effect events - call them only from effect code: passed raw into the session, they'd be called from outside it
  const countUnreadMsg = useEffectEvent((session: JoinSession, msg: ChatMsg) => {
    if (isOpen || _isOwnMsg(msg)) return
    updateChat(session, (prev) => ({ ...prev, unreadCount: prev.unreadCount + 1 }))
  })
  const goToCatList = useEffectEvent(() => {
    useUserMsgStore.getState().queueErrorNavigationMsg('This cat was deleted')
    void navigate('/cat', { replace: true })
  })

  useEffect(() => {
    const session = createJoinSession(catId, setChat, () => goToCatList())
    sessionRef.current = session
    join(session)

    // The socket is app-wide, so an event from a room just left can still land here
    const onMsgAdded = ({ msg }: ChatMsgEvent) => {
      if (msg.catId !== session.catId) return
      addMsgs(session, [msg])
      countUnreadMsg(session, msg)
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
      session.isActive = false
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

  async function loadOlder() {
    const session = sessionRef.current
    const beforeId = chat.msgs[0]?._id
    if (!session || !beforeId || chat.isOldestLoaded || chat.isLoadingOlder) return
    await loadOlderPage(session, beforeId)
  }

  function sendMsg(text: string) {
    const session = sessionRef.current
    const loggedInUser = useLoggedInUserStore.getState().loggedInUser
    if (!session || !loggedInUser) return
    sendNewMsg(session, loggedInUser, text)
  }

  // Only its author can retry a failed msg: after a logout or a login as someone else, the row
  // stays as failed
  function retrySendMsg(clientMsgId: string) {
    const session = sessionRef.current
    const loggedInUser = useLoggedInUserStore.getState().loggedInUser
    const pendingMsg = chat.pendingMsgs.find((msg) => msg.clientMsgId === clientMsgId)
    if (!session || !pendingMsg || pendingMsg.sendStatus !== 'failed') return
    if (pendingMsg.user._id !== loggedInUser?._id) return
    resendFailedMsg(session, pendingMsg)
  }

  // Both resolve to whether the change was saved
  function updateMsg(msgId: string, text: string) {
    const session = sessionRef.current
    if (!session) return Promise.resolve(false)
    return emitMsgUpdate(session, msgId, text)
  }

  function removeMsg(msgId: string) {
    const session = sessionRef.current
    if (!session) return Promise.resolve(false)
    return emitMsgRemove(session, msgId)
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
