import type React from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import type { ChatMsg } from '@cat-store/shared'
import { useCatChat } from '../../../hooks/use-cat-chat/use-cat-chat'
import { useLoggedInUserStore } from '../../../store/logged-in-user.store'
import { ReviewListSkeleton } from '../../common/review/review-list-skeleton'
import { ChatComposer } from './chat-footer/chat-composer'
import { ChatGuestCta } from './chat-footer/chat-guest-cta'
import { ChatHeader } from './chat-header'
import { ChatIcon } from './chat-icon'
import { ChatJoinError } from './chat-main/chat-join-error'
import { ChatLog } from './chat-main/chat-log'
import { ChatMsgRemoveConfirm } from './chat-msg/chat-msg-remove-confirm'

type ChatMsgWithText = Extract<ChatMsg, { isDeleted: false }>

interface CatChatProps {
  catId: string
  catName: string
  catOwnerId: string // for the Owner chip
}

// The chat icon (bottom right, with the unread badge) and the panel it opens. Closing only hides
// the panel: the room stays joined and the msgs stay in the hook, so a reopen doesn't refetch and
// the badge counts again.
export const CatChat: React.FC<CatChatProps> = ({ catId, catName, catOwnerId }) => {
  const [isOpen, setIsOpen] = useState(false)
  const chat = useCatChat(catId, isOpen)
  const loggedInUser = useLoggedInUserStore((state) => state.loggedInUser)
  const iconRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const titleId = useId()
  // Without isToggledRef, the chat icon is focused on mount: a closed chat never steals focus from the page
  const isToggledRef = useRef(false)
  // The id of the msg the delete confirm asks about
  const [removeMsgId, setRemoveMsgId] = useState<string | null>(null)
  // The msg itself, quoted in the confirm. Gone or already a tombstone (someone else deleted it
  // meanwhile) closes the confirm: there's nothing left to delete
  const msgToRemove = removeMsgId
    ? chat.msgs.find((msg): msg is ChatMsgWithText => msg._id === removeMsgId && !msg.isDeleted)
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

  function toggleOpen(isOpenNext: boolean) {
    isToggledRef.current = true
    setIsOpen(isOpenNext)
    // Closing hides the panel, so a reopen starts without the confirm
    setRemoveMsgId(null)
  }

  function openRemoveConfirm(msgId: string) {
    removeConfirmOpenerRef.current = document.activeElement as HTMLElement | null
    setRemoveMsgId(msgId)
  }

  function onConfirmRemove() {
    if (removeMsgId) void chat.removeMsg(removeMsgId)
    setRemoveMsgId(null)
  }

  // Escape closes, like the other popups. A click outside doesn't: the panel is a place to stay
  function onPanelKeyDown(ev: React.KeyboardEvent) {
    if (ev.key === 'Escape') toggleOpen(false)
  }

  if (!isOpen) {
    return (
      <div className="cat-chat">
        <ChatIcon ref={iconRef} unreadCount={chat.unreadCount} onOpen={() => toggleOpen(true)} />
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
        <ChatHeader titleId={titleId} catName={catName} onClose={() => toggleOpen(false)} />

        {/* Inert under the delete confirm, which covers it. The header stays live */}
        <div className="chat-body" inert={isRemoveConfirmOpen}>
          {chat.status === 'error' && <ChatJoinError onRetry={chat.retryLoadChat} />}

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

          {loggedInUser ? (
            <ChatComposer
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
            onCancel={() => setRemoveMsgId(null)}
          />
        )}
      </section>
    </div>
  )
}
