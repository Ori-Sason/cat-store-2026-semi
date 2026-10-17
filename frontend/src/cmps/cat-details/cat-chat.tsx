import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useCatChat } from '../../hooks/use-cat-chat'
import { useLoggedInUserStore } from '../../store/logged-in-user.store'
import { ReviewListSkeleton } from '../common/review/review-list-skeleton'
import { ChatLog } from './chat-log'

// More than this shows as "99+", so the badge stays one small pill
const _MAX_BADGE_COUNT = 99

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
  // Without isToggledRef, chat-icon is focuses on mount: a closed chat never steals focus from the page
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
    const { unreadCount } = chat
    return (
      <div className="cat-chat">
        <button
          ref={iconRef}
          type="button"
          className="chat-icon"
          aria-label={unreadCount ? `Open chat, ${unreadCount} unread` : 'Open chat'}
          onClick={() => toggle(true)}
        >
          <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true">
            <path
              fill="currentColor"
              d="M12 3C6.9 3 3 6.6 3 11c0 2.3 1.1 4.4 2.9 5.9L5 21l4.4-2.3c.8.2 1.7.3 2.6.3 5.1 0 9-3.6 9-8s-3.9-8-9-8Z"
            />
          </svg>
          {unreadCount > 0 && (
            <span className="badge" aria-hidden="true">
              {unreadCount > _MAX_BADGE_COUNT ? `${_MAX_BADGE_COUNT}+` : unreadCount}
            </span>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className="cat-chat">
      <section
        ref={panelRef}
        className="chat-panel"
        aria-labelledby="cat-chat-title"
        tabIndex={-1}
        onKeyDown={onPanelKeyDown}
      >
        <header>
          <div className="title">
            <h2 id="cat-chat-title">Chat</h2>
            <p>About {catName}</p>
          </div>
          <button
            type="button"
            className="close-btn"
            aria-label="Close chat"
            onClick={() => toggle(false)}
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

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
