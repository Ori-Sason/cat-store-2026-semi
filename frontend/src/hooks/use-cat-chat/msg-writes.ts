import {
  CHAT_MSG_ADD,
  CHAT_MSG_REMOVE,
  CHAT_MSG_UPDATE,
  type ChatMsgInput,
  type ChatMsgRemoveInput,
  type ChatMsgUpdateInput,
  type LoggedInUser,
} from '@cat-store/shared'
import { ApiError } from '../../models/api-error'
import type { PendingChatMsg } from '../../models/chat'
import { chatService } from '../../services/chat.service'
import { errorService } from '../../services/error.service'
import { socketService } from '../../services/socket.service'
import { utilService } from '../../services/util.service'
import { useUserMsgStore } from '../../store/user-msg.store'
import type { ChatMsgBusyAction, ChatMsgEvent } from './chat-state'
import { addMsgs, changeMsg, type JoinSession, updateChat } from './join-session'

// The viewer's own writes: send and retry (optimistic), edit and remove (wait for the ack)

// Optimistic: the msg shows at once as pending, and the ack or the broadcast replaces it with
// the saved one. text is the composer's, already trimmed and checked
export function sendNewMsg(session: JoinSession, loggedInUser: LoggedInUser, text: string) {
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
  void _sendPendingMsg(session, pendingMsg)
}

// The same clientMsgId, so a msg that was saved after all (only the ack got lost) is deduped by
// the server, which acks the saved copy. The caller checks it's failed and the viewer's own
export function resendFailedMsg(session: JoinSession, failedMsg: PendingChatMsg) {
  const retriedMsg: PendingChatMsg = { ...failedMsg, sendStatus: 'sending' }
  updateChat(session, (prev) => ({
    ...prev,
    pendingMsgs: prev.pendingMsgs.map((msg) =>
      msg.clientMsgId === retriedMsg.clientMsgId ? retriedMsg : msg,
    ),
  }))
  void _sendPendingMsg(session, retriedMsg)
}

// text is the inline editor's, already trimmed and checked. Only the author may edit: the UI
// offers it per chatPermissionService, and the server enforces it
export function emitMsgUpdate(session: JoinSession, msgId: string, text: string) {
  const payload = { catId: session.catId, msgId, text } satisfies ChatMsgUpdateInput
  return _emitMsgChange(session, msgId, 'updating', () =>
    socketService.emitWithAck<ChatMsgEvent>(CHAT_MSG_UPDATE, payload),
  )
}

// The ack is the tombstone. The author or an admin, like the edit's checks
export function emitMsgRemove(session: JoinSession, msgId: string) {
  const payload = { catId: session.catId, msgId } satisfies ChatMsgRemoveInput
  return _emitMsgChange(session, msgId, 'removing', () =>
    socketService.emitWithAck<ChatMsgEvent>(CHAT_MSG_REMOVE, payload),
  )
}

// One try of a pending msg, the first or a retry. The DB write is awaited on the server before
// the ack, so the ack means saved. The broadcast may land first: then this ack only dedupes.
// A failure marks it failed, unless the broadcast already saved it.
// Only an UNAUTHORIZED logs the user out (socketService clears the user on it). A timeout or a
// lost connection is a NETWORK_ERROR: failed, and the user stays logged in
async function _sendPendingMsg(session: JoinSession, pendingMsg: PendingChatMsg) {
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
    if (!session.isActive) return
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
async function _emitMsgChange(
  session: JoinSession,
  msgId: string,
  action: ChatMsgBusyAction,
  emit: () => Promise<ChatMsgEvent>,
) {
  if (!session.isActive) return false
  _setMsgBusy(session, msgId, action)
  try {
    const { msg } = await emit()
    changeMsg(session, msg)
    return session.isActive
  } catch (err) {
    if (!session.isActive) return false
    if (err instanceof ApiError && err.code === 'UNAUTHORIZED') {
      _showSessionExpiredMsg()
    } else {
      const failedTxt = action === 'updating' ? "Couldn't save your edit." : "Couldn't delete it."
      useUserMsgStore.getState().showErrorMsg(`${failedTxt} ${errorService.getErrorMsg(err)}`)
    }
    return false
  } finally {
    _setMsgBusy(session, msgId, null)
  }
}

function _setMsgBusy(session: JoinSession, msgId: string, action: ChatMsgBusyAction | null) {
  updateChat(session, (prev) => {
    const busyMsgs = { ...prev.busyMsgs }
    if (action) busyMsgs[msgId] = action
    else delete busyMsgs[msgId]
    return { ...prev, busyMsgs }
  })
}

// Like a REST 401: socketService already cleared the user. No redirect: the user stays on the page
// as a guest, and can still read
function _showSessionExpiredMsg() {
  useUserMsgStore.getState().showErrorMsg('Your session expired. Log in to keep chatting.')
}
