import type React from 'react'
import type { Ref } from 'react'

// More than this shows as "99+", so the badge stays one small pill
const _MAX_BADGE_COUNT = 99

interface ChatIconProps {
  unreadCount: number
  onOpen: () => void
  ref?: Ref<HTMLButtonElement> // CatChat gives the focus back here when the panel closes
}

// The round button that opens the chat, bottom right, with the unread badge
export const ChatIcon: React.FC<ChatIconProps> = ({ unreadCount, onOpen, ref }) => {
  return (
    <button
      ref={ref}
      type="button"
      className="chat-icon"
      aria-label={unreadCount ? `Open chat, ${unreadCount} unread` : 'Open chat'}
      onClick={onOpen}
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
  )
}
