import type React from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { useCatChat } from '../../../hooks/cat-chat/use-cat-chat/use-cat-chat'
import { useChatMsgRemoveConfirm } from '../../../hooks/cat-chat/use-chat-msg-remove-confirm'
import { chatService } from '../../../services/chat.service'
import { useLoggedInUserStore } from '../../../store/logged-in-user.store'
import { ReviewListSkeleton } from '../../common/review/review-list-skeleton'
import { ChatComposer } from './chat-footer/chat-composer'
import { ChatGuestCta } from './chat-footer/chat-guest-cta'
import { ChatHeader } from './chat-header/chat-header'
import { ChatIcon } from './chat-icon'
import { ChatJoinError } from './chat-main/chat-join-error'
import { ChatLog } from './chat-main/chat-log'
import { ChatPresenceList } from './chat-main/chat-presence-list'
import { ChatMsgRemoveConfirm } from './chat-msg/chat-msg-remove-confirm'
import { ChatTyping } from './chat-footer/chat-typing'

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
  // The panel body shows the log (with the typing line and the composer) or the "here now" list
  const [view, setView] = useState<'log' | 'presence'>('log')
  const presenceBtnRef = useRef<HTMLButtonElement>(null)

  // Names reach only a logged-in socket, and only a logged-in viewer is shown them
  const presenceUsers = loggedInUser ? (chat.presence?.users ?? null) : null
  const isPresenceListAvailable = !!presenceUsers?.some((user) => user._id !== loggedInUser?._id)

  if (view === 'presence' && !isPresenceListAvailable) setView('log')
  const isPresenceListShown = view === 'presence' && isPresenceListAvailable

  useEffect(() => {
    if (!isToggledRef.current) return
    if (isOpen) panelRef.current?.focus()
    else iconRef.current?.focus()
  }, [isOpen])

  // The presence list closed by itself and took the focused back button with it. "Back to chat"
  // moves the focus itself, so this only catches the focus that dropped to <body>
  useEffect(() => {
    if (isPresenceListShown || document.activeElement !== document.body) return
    panelRef.current?.focus()
  }, [isPresenceListShown])

  function onComposerTextChange(text: string) {
    setComposerText(text)
    chat.reportTyping(text)
  }

  function toggleOpen(isOpenNext: boolean) {
    isToggledRef.current = true
    setIsOpen(isOpenNext)
    // Closing hides the panel, so a reopen starts on the log, without the confirm
    removeConfirm.cancel()
    setView('log')
  }

  // The header's count only opens the list. The way back is "Back to chat", so a second click on
  // the count does nothing
  function openPresenceList() {
    if (isPresenceListShown) return
    // The confirm belongs to the log, which the list hides
    removeConfirm.cancel()
    setView('presence')
  }

  // The header's count is still there (the list shows only while it's a button), so it takes the focus
  function closePresenceList() {
    setView('log')
    presenceBtnRef.current?.focus()
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
        <ChatHeader
          titleId={titleId}
          catName={catName}
          presenceCount={{
            count: chat.presence?.count ?? 0,
            isJustYou: !!presenceUsers && !isPresenceListAvailable,
            isListAvailable: isPresenceListAvailable,
            isListShown: isPresenceListShown,
            onOpenList: openPresenceList,
            ref: presenceBtnRef,
          }}
          onClose={() => toggleOpen(false)}
        />

        {/* Inert under the delete confirm and the "here now" list, which cover it. The header
            stays live.
            Hidden, not unmounted, under the list: an open inline edit, the scroll
            position and the pin to the bottom survive a look at who's here */}
        <div
          className={`chat-body${isPresenceListShown ? ' is-hidden' : ''}`}
          inert={removeConfirm.isOpen || isPresenceListShown}
        >
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

          {/* Guests see it too: the chat is public to read */}
          <ChatTyping typers={chat.typers} />

          {loggedInUser ? (
            <ChatComposer
              catId={catId}
              text={composerText}
              onTextChange={onComposerTextChange}
              isDisabled={chat.status !== 'ready'}
              onSendMsg={chat.sendMsg}
            />
          ) : (
            <ChatGuestCta />
          )}
        </div>

        {isPresenceListShown && loggedInUser && presenceUsers && (
          <ChatPresenceList
            users={presenceUsers}
            loggedInUserId={loggedInUser._id}
            catOwnerId={catOwnerId}
            onBack={closePresenceList}
          />
        )}

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
