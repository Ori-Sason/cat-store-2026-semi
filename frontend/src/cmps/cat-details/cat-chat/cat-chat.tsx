import type React from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import type { ChatMsg } from '@cat-store/shared'
import { useCatChat } from '../../../hooks/use-cat-chat'
import { useLoggedInUserStore } from '../../../store/logged-in-user.store'
import { ReviewListSkeleton } from '../../common/review/review-list-skeleton'
import { ChatComposer } from './chat-composer'
import { ChatGuestCta } from './chat-guest-cta'
import { ChatHeader } from './chat-header'
import { ChatIcon } from './chat-icon'
import { ChatLog } from './chat-log'
import { ChatMsgRemoveConfirm } from './chat-msg-remove-confirm'

type ChatMsgWithText = Extract<ChatMsg, { isDeleted: false }>

interface CatChatProps {
  catId: string
  catName: string
  catOwnerId: string // for the Owner chip
}

// The chat icon (bottom right, with the unread badge) and the panel it opens. Closing only hides
// the panel: the room stays joined and the msgs stay in the hook, so a reopen doesn't refetch and
// the badge counts again. So there's no separate minimize
export const CatChat: React.FC<CatChatProps> = ({ catId, catName, catOwnerId }) => {
  const [isOpen, setIsOpen] = useState(false)
  const chat = useCatChat(catId, isOpen)
  const loggedInUser = useLoggedInUserStore((state) => state.loggedInUser)
  const iconRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const titleId = useId()
  // Without isToggledRef, the chat icon is focused on mount: a closed chat never steals focus from the page
  const isToggledRef = useRef(false)
  // The msg the delete confirm asks about. Keyed by cat too: a cat switch can reuse this page,
  // and a confirm for the old cat's msg must not show under the new one
  const [removeConfirm, setRemoveConfirm] = useState<{ catId: string; msgId: string } | null>(null)
  // The msg itself, quoted in the confirm. Gone or already a tombstone (someone else deleted it
  // meanwhile) closes the confirm: there's nothing left to delete
  const msgToRemove =
    removeConfirm?.catId === catId
      ? chat.msgs.find(
          (msg): msg is ChatMsgWithText => msg._id === removeConfirm.msgId && !msg.isDeleted,
        )
      : undefined
  const isRemoveConfirmOpen = !!msgToRemove
  // Where the focus goes back to when the confirm closes: the msg's ⋮ button
  const removeConfirmOpenerRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!isToggledRef.current) return
    if (isOpen) panelRef.current?.focus()
    else iconRef.current?.focus()
  }, [isOpen])

  // After the confirm closes, in an effect: until this render the log was inert, and an inert
  // element can't take the focus. A confirmed remove disables the ⋮ button until its ack, so the
  // panel takes the focus then, and it doesn't drop to <body>
  useEffect(() => {
    const opener = removeConfirmOpenerRef.current
    if (isRemoveConfirmOpen || !opener) return
    removeConfirmOpenerRef.current = null
    if (opener.isConnected && !opener.matches(':disabled')) opener.focus()
    else panelRef.current?.focus()
  }, [isRemoveConfirmOpen])

  function toggle(isOpenNext: boolean) {
    isToggledRef.current = true
    setIsOpen(isOpenNext)
    // Closing hides the panel, so a reopen starts without the confirm
    setRemoveConfirm(null)
  }

  function openRemoveConfirm(msgId: string) {
    removeConfirmOpenerRef.current = document.activeElement as HTMLElement | null
    setRemoveConfirm({ catId, msgId })
  }

  function onConfirmRemove() {
    if (removeConfirm) void chat.removeMsg(removeConfirm.msgId)
    setRemoveConfirm(null)
  }

  // Escape closes, like the other popups. A click outside doesn't: the panel is a place to stay
  function onPanelKeyDown(ev: React.KeyboardEvent) {
    if (ev.key === 'Escape') toggle(false)
  }

  if (!isOpen) {
    return (
      <div className="cat-chat">
        <ChatIcon ref={iconRef} unreadCount={chat.unreadCount} onOpen={() => toggle(true)} />
      </div>
    )
  }

  return (
    <div className="cat-chat">
      <section
        ref={panelRef}
        className="chat-panel"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onPanelKeyDown}
      >
        <ChatHeader titleId={titleId} catName={catName} onClose={() => toggle(false)} />

        {/* Inert under the delete confirm, which covers it. The header stays live */}
        <div className="chat-body" inert={isRemoveConfirmOpen}>
          {chat.status === 'error' && (
            <div className="join-error" role="alert">
              <p>Couldn't connect to the chat.</p>
              <button type="button" className="main-btn" onClick={chat.retryLoadChat}>
                Retry
              </button>
            </div>
          )}
          {/* idle too: the first render after opening comes before the hook's fetch starts */}
          {(chat.status === 'idle' || chat.status === 'loading') && (
            <div className="loading">
              <ReviewListSkeleton label="Loading messages" />
            </div>
          )}
          {chat.status === 'ready' && (
            <ChatLog
              msgs={chat.msgs}
              pendingMsgs={chat.pendingMsgs}
              catOwnerId={catOwnerId}
              isOlderAvailable={chat.isOlderAvailable}
              isLoadingOlder={chat.isLoadingOlder}
              onLoadOlder={() => void chat.loadOlder()}
              onRetrySendMsg={chat.retrySendMsg}
              busyMsgs={chat.busyMsgs}
              onUpdateMsg={chat.updateMsg}
              onRemoveMsg={openRemoveConfirm}
            />
          )}

          {/* Keyed by cat: a cat switch can reuse this page, and the text belongs to the old cat */}
          {loggedInUser ? (
            <ChatComposer
              key={catId}
              catId={catId}
              isDisabled={chat.status !== 'ready'}
              onSendMsg={chat.sendMsg}
            />
          ) : (
            <ChatGuestCta />
          )}
        </div>

        {msgToRemove && (
          <ChatMsgRemoveConfirm
            msgText={msgToRemove.text}
            onConfirm={onConfirmRemove}
            onCancel={() => setRemoveConfirm(null)}
          />
        )}
      </section>
    </div>
  )
}
