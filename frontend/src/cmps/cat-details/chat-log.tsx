import type React from 'react'
import { useLayoutEffect, useRef } from 'react'
import type { ChatMsg } from '@cat-store/shared'
import { utilService } from '../../services/util.service'
import { ChatMsgPreview } from './chat-msg-preview'

// Closer than this to the bottom counts as "at the bottom", so a new msg keeps the log pinned
const _STICK_TO_BOTTOM_PX = 48

interface ChatLogProps {
  msgs: ChatMsg[]
  catOwnerId: string
  isOlderAvailable: boolean
  isLoadingOlder: boolean
  onLoadOlder: () => void
}

// What the log looked like after the last render, to compare against after the next one
interface ScrollSnapshot {
  firstMsgId: string | null
  lastMsgId: string | null
  scrollTop: number
  scrollHeight: number
  isAtBottom: boolean
}

// The scrolling list of msgs, grouped under day dividers. It opens at the newest msg, follows new
// msgs while the reader is at the bottom, and keeps the view still when older msgs load above
export const ChatLog: React.FC<ChatLogProps> = ({
  msgs,
  catOwnerId,
  isOlderAvailable,
  isLoadingOlder,
  onLoadOlder,
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

    if (!prev?.lastMsgId) {
      log.scrollTop = log.scrollHeight // the first msgs: open at the newest
    } else if (firstMsgId !== prev.firstMsgId) {
      // Older msgs went in above: move down by what was added, so the same rows stay in view
      log.scrollTop = prev.scrollTop + (log.scrollHeight - prev.scrollHeight)
    } else if (lastMsgId !== prev.lastMsgId && prev.isAtBottom) {
      log.scrollTop = log.scrollHeight
    }
    snapshotRef.current = { firstMsgId, lastMsgId, ..._readScroll(log) }
  }, [msgs])

  // Keeps the snapshot current between renders, so the next fix starts from where the reader is
  function onScroll() {
    const log = logRef.current
    const snapshot = snapshotRef.current
    if (log && snapshot) snapshotRef.current = { ...snapshot, ..._readScroll(log) }
  }

  if (!msgs.length) {
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
      {_groupByDay(msgs).map(({ dayKey, label, msgs }) => (
        <section key={dayKey} className="day" aria-label={label}>
          <h3 className="day-divider" aria-hidden="true">
            {label}
          </h3>
          <ol className="clean-list">
            {msgs.map((msg) => (
              <li key={msg._id}>
                <ChatMsgPreview msg={msg} catOwnerId={catOwnerId} />
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

// Consecutive msgs of one local calendar day. msgs are in _id order, which is time order
function _groupByDay(msgs: ChatMsg[]) {
  const groups: { dayKey: string; label: string; msgs: ChatMsg[] }[] = []
  for (const msg of msgs) {
    const dayKey = new Date(msg.createdAt).toDateString()
    const lastGroup = groups.at(-1)
    if (lastGroup?.dayKey === dayKey) lastGroup.msgs.push(msg)
    else groups.push({ dayKey, label: _getDayLabel(msg.createdAt), msgs: [msg] })
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
