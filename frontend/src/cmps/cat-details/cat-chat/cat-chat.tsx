import type React from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { useCatChat } from '../../../hooks/cat-chat/use-cat-chat/use-cat-chat'
import { useChatMsgRemoveConfirm } from '../../../hooks/cat-chat/use-chat-msg-remove-confirm'
import { useChatPresenceList } from '../../../hooks/cat-chat/use-chat-presence-list'
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
  isCatDeleting: boolean // the page's delete is in flight (see useCatChat)
}

// The chat icon (bottom right, with the unread badge) and the panel it opens. Closing only hides
// the panel: the room stays joined and the msgs stay in the hook, so a reopen doesn't refetch and
// the badge counts again.
export const CatChat: React.FC<CatChatProps> = ({ catId, catName, catOwnerId, isCatDeleting }) => {
  const [isOpen, setIsOpen] = useState(false)
  const chat = useCatChat(catId, isOpen, isCatDeleting)
  const loggedInUser = useLoggedInUserStore((state) => state.loggedInUser)
  const iconRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const titleId = useId()
  // Without isToggledRef, the chat icon is focused on mount: a closed chat never steals focus from the page
  const isToggledRef = useRef(false)
  // Here, not in the composer: closing the panel unmounts the composer, and its text should
  // survive that. It starts from the draft a send left when the session expired
  // (see chatService.saveDraft). The cat-details key resets it on a cat switch.
  // Only for a logged-in user: a guest has no composer, and its "Log in" leaves the page, so a
  // draft restored then would be lost. It stays in storage for the logged-in mount.
  // Read once per mount: a login later in this mount restores nothing
  const [restoredDraft] = useState(() => (loggedInUser && chatService.getDraft(catId)) || null)
  const [composerText, setComposerText] = useState(restoredDraft ?? '')
  const removeConfirm = useChatMsgRemoveConfirm(chat.msgs, chat.removeMsg, panelRef)
  const presenceList = useChatPresenceList(chat.presence, loggedInUser, panelRef)

  // Restored into composerText, the draft's job is done: the text lives in the state from here,
  // and a new UNAUTHORIZED saves it again. In an effect, not the initializer, which must stay pure
  useEffect(() => {
    if (restoredDraft !== null) chatService.removeDraft(catId)
  }, [catId, restoredDraft])

  useEffect(() => {
    if (!isToggledRef.current) return
    if (isOpen) panelRef.current?.focus()
    else iconRef.current?.focus()
  }, [isOpen])

  function onComposerTextChange(text: string) {
    setComposerText(text)
    chat.reportTyping(text)
  }

  function toggleOpen(isOpenNext: boolean) {
    isToggledRef.current = true
    setIsOpen(isOpenNext)
    // Closing hides the panel, so a reopen starts on the log, without the confirm
    removeConfirm.cancel()
    presenceList.reset()
  }

  function openPresenceList() {
    // The confirm belongs to the log, which the list hides
    removeConfirm.cancel()
    presenceList.showList()
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
            isJustYou: presenceList.isJustYou,
            isListAvailable: presenceList.isAvailable,
            isListShown: presenceList.isShown,
            onOpenList: openPresenceList,
            ref: presenceList.countRef,
          }}
          onClose={() => toggleOpen(false)}
        />

        {/* Inert under the delete confirm and the "here now" list, which cover it. The header
            stays live.
            Hidden, not unmounted, under the list: an open inline edit, the scroll
            position and the pin to the bottom survive a look at who's here */}
        <div
          className={`chat-body${presenceList.isShown ? ' is-hidden' : ''}`}
          inert={removeConfirm.isOpen || presenceList.isShown}
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
              text={composerText}
              onTextChange={onComposerTextChange}
              isDisabled={chat.status !== 'ready'}
              onSendMsg={chat.sendMsg}
            />
          ) : (
            <ChatGuestCta />
          )}
        </div>

        {presenceList.isShown && loggedInUser && presenceList.users && (
          <ChatPresenceList
            users={presenceList.users}
            loggedInUserId={loggedInUser._id}
            catOwnerId={catOwnerId}
            onBack={presenceList.hideList}
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
