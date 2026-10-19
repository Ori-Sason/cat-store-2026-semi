import type React from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { useCatChat } from '../../../hooks/cat-chat/use-cat-chat/use-cat-chat'
import { useChatMsgRemoveConfirm } from '../../../hooks/cat-chat/use-chat-msg-remove-confirm'
import { chatService } from '../../../services/chat.service'
import { useLoggedInUserStore } from '../../../store/logged-in-user.store'
import { ReviewListSkeleton } from '../../common/review/review-list-skeleton'
import { ChatComposer } from './chat-footer/chat-composer'
import { ChatGuestCta } from './chat-footer/chat-guest-cta'
import { ChatHeader } from './chat-header'
import { ChatIcon } from './chat-icon'
import { ChatJoinError } from './chat-main/chat-join-error'
import { ChatLog } from './chat-main/chat-log'
import { ChatMsgRemoveConfirm } from './chat-msg/chat-msg-remove-confirm'

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
  // Here, not in the composer: closing the panel unmounts the composer, and its text should
  // survive that. It starts from the draft a send left when the session expired
  // (see chatService.saveDraft). The cat-details key resets it on a cat switch
  const [composerText, setComposerText] = useState(() => chatService.getDraft(catId) ?? '')
  const removeConfirm = useChatMsgRemoveConfirm(chat.msgs, chat.removeMsg, panelRef)

  useEffect(() => {
    if (!isToggledRef.current) return
    if (isOpen) panelRef.current?.focus()
    else iconRef.current?.focus()
  }, [isOpen])

  function toggleOpen(isOpenNext: boolean) {
    isToggledRef.current = true
    setIsOpen(isOpenNext)
    // Closing hides the panel, so a reopen starts without the confirm
    removeConfirm.cancel()
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
        <div className="chat-body" inert={removeConfirm.isOpen}>
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
              onRemoveMsg={removeConfirm.open}
            />
          )}

          {loggedInUser ? (
            <ChatComposer
              catId={catId}
              text={composerText}
              onTextChange={setComposerText}
              isDisabled={chat.status !== 'ready'}
              onSendMsg={chat.sendMsg}
            />
          ) : (
            <ChatGuestCta />
          )}
        </div>

        {removeConfirm.msgToRemove && (
          <ChatMsgRemoveConfirm
            msgText={removeConfirm.msgToRemove.text}
            onConfirm={removeConfirm.confirm}
            onCancel={removeConfirm.cancel}
          />
        )}
      </section>
    </div>
  )
}
