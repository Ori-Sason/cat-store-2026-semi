import type React from 'react'
import { useEffect, useId, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useCatChat } from '../../../hooks/use-cat-chat'
import { useLoggedInUserStore } from '../../../store/logged-in-user.store'
import { ReviewListSkeleton } from '../../common/review/review-list-skeleton'
import { ChatHeader } from './chat-header'
import { ChatIcon } from './chat-icon'
import { ChatLog } from './chat-log'

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
  const location = useLocation()
  const iconRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const titleId = useId()
  // Without isToggledRef, the chat icon is focused on mount: a closed chat never steals focus from the page
  const isToggledRef = useRef(false)

  useEffect(() => {
    if (!isToggledRef.current) return
    if (isOpen) panelRef.current?.focus()
    else iconRef.current?.focus()
  }, [isOpen])

  function toggle(isOpenNext: boolean) {
    isToggledRef.current = true
    setIsOpen(isOpenNext)
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

        {chat.status === 'error' && (
          <div className="join-error" role="alert">
            <p>Couldn't connect to the chat.</p>
            <button type="button" className="main-btn" onClick={chat.retry}>
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
            catOwnerId={catOwnerId}
            isOlderAvailable={chat.isOlderAvailable}
            isLoadingOlder={chat.isLoadingOlder}
            onLoadOlder={() => void chat.loadOlder()}
          />
        )}

        {!loggedInUser && (
          <div className="guest-cta">
            <p>You're reading as a guest.</p>
            <Link
              to={`/login?redirectTo=${encodeURIComponent(location.pathname + location.search)}`}
              className="main-btn"
            >
              Log in to chat
            </Link>
          </div>
        )}
      </section>
    </div>
  )
}
