import type React from 'react'
import { useLayoutEffect, useRef } from 'react'
import type { ChatMsg } from '@cat-store/shared'
import type { ChatMsgBusyAction } from '../../../hooks/use-cat-chat/chat-state'
import type { PendingChatMsg } from '../../../models/chat'
import { utilService } from '../../../services/util.service'
import { ChatMsgPreview } from './chat-msg-preview'

// Closer than this to the bottom counts as "at the bottom", so a new msg keeps the log pinned
const _STICK_TO_BOTTOM_PX = 48

interface ChatLogProps {
  msgs: ChatMsg[]
  pendingMsgs: PendingChatMsg[] // shown below the saved msgs, in send order
  catOwnerId: string
  isOlderAvailable: boolean
  isLoadingOlder: boolean
  onLoadOlder: () => void
  onRetrySendMsg: (clientMsgId: string) => void
  busyMsgs: Partial<Record<string, ChatMsgBusyAction>> // by _id
  onUpdateMsg: (msgId: string, text: string) => Promise<boolean>
  onRemoveMsg: (msgId: string) => void // asks for the delete confirm
}

// A saved msg is keyed by its _id, a pending one by its clientMsgId (it has no _id yet)
interface LogRow {
  key: string
  msg: ChatMsg | PendingChatMsg
}

// What the log looked like after the last render, to compare against after the next one
interface ScrollSnapshot {
  firstMsgId: string | null
  lastMsgId: string | null
  pendingMsgIds: Set<string> // clientMsgIds, to spot a new own send
  scrollTop: number
  scrollHeight: number
  isAtBottom: boolean
}

// The scrolling list of msgs, grouped under day dividers. It opens at the newest msg, follows new
// msgs while the reader is at the bottom, jumps to the bottom on an own send, and keeps the view
// still when older msgs load above
export const ChatLog: React.FC<ChatLogProps> = ({
  msgs,
  pendingMsgs,
  catOwnerId,
  isOlderAvailable,
  isLoadingOlder,
  onLoadOlder,
  onRetrySendMsg,
  busyMsgs,
  onUpdateMsg,
  onRemoveMsg,
}) => {
  const logRef = useRef<HTMLDivElement>(null)
  const snapshotRef = useRef<ScrollSnapshot | null>(null)

  // Layout effect: the scroll fix lands before paint, so a prepend never flashes at the wrong spot.
  // overflow-anchor is off in the SCSS, or the browser would apply its own fix on top of this one
  useLayoutEffect(() => {
    const log = logRef.current
    if (!log) return
    const prev = snapshotRef.current
    const firstMsgId = msgs[0]?._id ?? null
    const lastMsgId = msgs.at(-1)?._id ?? null
    const pendingMsgIds = new Set(pendingMsgs.map((msg) => msg.clientMsgId))
    // A send appends a pending msg. Its author wants to see it, even when scrolled up to read
    const isNewSend = pendingMsgs.some((msg) => !prev?.pendingMsgIds.has(msg.clientMsgId))

    if (!prev?.lastMsgId || isNewSend) {
      log.scrollTop = log.scrollHeight // the first msgs or an own send: to the newest
    } else if (firstMsgId !== prev.firstMsgId) {
      // Older msgs went in above: move down by what was added, so the same rows stay in view
      log.scrollTop = prev.scrollTop + (log.scrollHeight - prev.scrollHeight)
    } else if (lastMsgId !== prev.lastMsgId && prev.isAtBottom) {
      log.scrollTop = log.scrollHeight
    }
    snapshotRef.current = { firstMsgId, lastMsgId, pendingMsgIds, ..._readScroll(log) }
  }, [msgs, pendingMsgs])

  // Keeps the snapshot current between renders, so the next fix starts from where the reader is
  function onScroll() {
    const log = logRef.current
    const snapshot = snapshotRef.current
    if (log && snapshot) snapshotRef.current = { ...snapshot, ..._readScroll(log) }
  }

  if (!msgs.length && !pendingMsgs.length) {
    return (
      <div className="chat-log is-empty">
        <p className="empty-title">No messages yet</p>
        <p>Ask the owner or other buyers anything. Everyone on this page can see the messages.</p>
      </div>
    )
  }

  return (
    <div ref={logRef} className="chat-log" onScroll={onScroll}>
      {isOlderAvailable && (
        <div className="older">
          <button type="button" disabled={isLoadingOlder} onClick={onLoadOlder}>
            {isLoadingOlder ? 'Loading…' : 'Load older'}
          </button>
        </div>
      )}
      {_groupByDay(msgs, pendingMsgs).map(({ dayKey, label, rows }) => (
        <section key={dayKey} className="day" aria-label={label}>
          <h3 className="day-divider" aria-hidden="true">
            {label}
          </h3>
          <ol className="clean-list">
            {rows.map(({ key, msg }) => (
              <li key={key}>
                {'_id' in msg ? (
                  <ChatMsgPreview
                    msg={msg}
                    catOwnerId={catOwnerId}
                    busyAction={busyMsgs[msg._id]}
                    onUpdate={(text) => onUpdateMsg(msg._id, text)}
                    onRemove={() => onRemoveMsg(msg._id)}
                  />
                ) : (
                  <ChatMsgPreview
                    msg={msg}
                    catOwnerId={catOwnerId}
                    onRetry={() => onRetrySendMsg(msg.clientMsgId)}
                  />
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}

function _readScroll(log: HTMLElement) {
  const { scrollTop, scrollHeight, clientHeight } = log
  return {
    scrollTop,
    scrollHeight,
    isAtBottom: scrollHeight - scrollTop - clientHeight < _STICK_TO_BOTTOM_PX,
  }
}

// Consecutive rows of one local calendar day. msgs are in _id order, which is time order, and the
// pending ones come after them: they were sent just now
function _groupByDay(msgs: ChatMsg[], pendingMsgs: PendingChatMsg[]) {
  const rows: LogRow[] = [
    ...msgs.map((msg) => ({ key: msg._id, msg })),
    ...pendingMsgs.map((msg) => ({ key: msg.clientMsgId, msg })),
  ]
  const groups: { dayKey: string; label: string; rows: LogRow[] }[] = []
  for (const row of rows) {
    const dayKey = new Date(row.msg.createdAt).toDateString()
    const lastGroup = groups.at(-1)
    if (lastGroup?.dayKey === dayKey) lastGroup.rows.push(row)
    else groups.push({ dayKey, label: _getDayLabel(row.msg.createdAt), rows: [row] })
  }
  return groups
}

function _getDayLabel(ms: number) {
  const day = new Date(ms).toDateString()
  const today = new Date()
  if (day === today.toDateString()) return 'Today'
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  if (day === yesterday.toDateString()) return 'Yesterday'
  return utilService.formatDate(ms)
}
