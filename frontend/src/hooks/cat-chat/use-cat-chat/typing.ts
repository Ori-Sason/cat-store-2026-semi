import { CHAT_TYPING, type ChatTyping, type ChatTypingInput } from '@cat-store/shared'
import { socketService } from '../../../services/socket.service'
import { type ChatRoomTracker, updateChat } from './chat-room-tracker'

// The typing indicator, both sides. The server keeps no typing state: it only relays, so the
// sender owns its true and its false, and a receiver times a typer out when the false never
// comes (a closed tab, a lost connection). chat:typing has no ack: plain emits

// A true at most this often while the viewer types. It also refreshes the receivers' timeout,
// so it must stay well under TYPER_TIMEOUT_MS
export const TYPING_THROTTLE_MS = 2_000
// No keystroke for this long sends the false
export const TYPING_IDLE_MS = 3_000
// A typer with no refresh for this long is dropped: the safety net for a false that never comes
export const TYPER_TIMEOUT_MS = 5_000

// Every change of the composer's text. Emptying it counts as stopping, so a cleared composer
// doesn't keep "typing…" up for the idle wait
export function reportOwnTyping(roomTracker: ChatRoomTracker, text: string) {
  if (!roomTracker.isActive) return
  if (!text.trim()) {
    stopOwnTyping(roomTracker)
    return
  }
  const ownTyping = roomTracker.ownTyping
  const now = Date.now()
  if (!ownTyping.isTyping || now - ownTyping.lastSentAt >= TYPING_THROTTLE_MS) {
    _emitTyping(roomTracker, true)
    ownTyping.isTyping = true
    ownTyping.lastSentAt = now
  }
  if (ownTyping.idleTimeout) clearTimeout(ownTyping.idleTimeout)
  ownTyping.idleTimeout = setTimeout(() => stopOwnTyping(roomTracker), TYPING_IDLE_MS)
}

// On idle, on send, and on leave. Sends the false only if a true went out, so a send without
// typing (e.g. a restored draft sent as is) emits nothing.
// The leave calls it before chat:leave: chat:typing needs room membership, and Socket.io keeps
// one socket's emits in order. No isActive check, since the leave is the one tearing down. It
// clears the idle timer, so nothing calls it after that
export function stopOwnTyping(roomTracker: ChatRoomTracker) {
  const ownTyping = roomTracker.ownTyping
  if (ownTyping.idleTimeout) clearTimeout(ownTyping.idleTimeout)
  ownTyping.idleTimeout = null
  if (!ownTyping.isTyping) return
  ownTyping.isTyping = false
  _emitTyping(roomTracker, false)
}

// A relayed chat:typing. The server leaves out the sending socket, not the user, so the
// viewer's other tab on this cat shows them typing too. Accepted: they know they're typing there.
// A true adds the typer, or keeps their place and restarts their timeout
export function onTyping(roomTracker: ChatRoomTracker, { user, isTyping }: ChatTyping) {
  if (!roomTracker.isActive) return

  _clearTyperTimeout(roomTracker, user._id)

  if (!isTyping) {
    _removeTyper(roomTracker, user._id)
    return
  }

  roomTracker.typerTimeoutById.set(
    user._id,
    setTimeout(() => {
      roomTracker.typerTimeoutById.delete(user._id)
      _removeTyper(roomTracker, user._id)
    }, TYPER_TIMEOUT_MS),
  )

  updateChat(roomTracker, (prev) => {
    const index = prev.typers.findIndex((typer) => typer._id === user._id)
    if (index === -1) return { ...prev, typers: [...prev.typers, user] }
    // Already shown: the latest copy, in case the name changed since
    const typers = prev.typers.with(index, user)
    return { ...prev, typers }
  })
}

// The leave's cleanup: no typer timeout may fire into a tracker that's gone
export function clearTyperTimeouts(roomTracker: ChatRoomTracker) {
  for (const timeout of roomTracker.typerTimeoutById.values()) clearTimeout(timeout)
  roomTracker.typerTimeoutById.clear()
}

function _emitTyping(roomTracker: ChatRoomTracker, isTyping: boolean) {
  socketService.emit(CHAT_TYPING, {
    catId: roomTracker.catId,
    isTyping,
  } satisfies ChatTypingInput)
}

function _clearTyperTimeout(roomTracker: ChatRoomTracker, userId: string) {
  const timeout = roomTracker.typerTimeoutById.get(userId)
  if (timeout) clearTimeout(timeout)
  roomTracker.typerTimeoutById.delete(userId)
}

function _removeTyper(roomTracker: ChatRoomTracker, userId: string) {
  updateChat(roomTracker, (prev) =>
    prev.typers.some((typer) => typer._id === userId)
      ? { ...prev, typers: prev.typers.filter((typer) => typer._id !== userId) }
      : prev,
  )
}
