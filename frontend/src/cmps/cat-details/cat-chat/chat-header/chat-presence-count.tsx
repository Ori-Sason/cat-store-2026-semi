import type React from 'react'
import type { Ref } from 'react'

export interface ChatPresenceCountProps {
  count: number // distinct logged-in users on the cat's page, the viewer included
  isJustYou: boolean // a logged-in viewer with nobody else there
  isListAvailable: boolean // a logged-in viewer with others there: the line opens the list
  isListShown: boolean
  onOpenList: () => void
  // CatChat gives the focus back here when the list closes on "Back to chat"
  ref: Ref<HTMLButtonElement>
}

// "2 here now" on the header's subtitle line, which renders it only for a count above 0. A button only when it has names to show: a guest
// never gets them, and "Just you here" would open a list of one. Not a live region, so joins and
// leaves aren't announced
export const ChatPresenceCount: React.FC<ChatPresenceCountProps> = ({
  count,
  isJustYou,
  isListAvailable,
  isListShown,
  onOpenList,
  ref,
}) => {
  const text = isJustYou ? 'Just you here' : `${count} here now`

  return isListAvailable ? (
    <button
      ref={ref}
      type="button"
      className="chat-presence-count"
      // Still focusable while the list shows (the focus comes back here from "Back to chat"),
      // but it has nothing left to do then
      aria-disabled={isListShown}
      onClick={onOpenList}
    >
      {text}
      <svg
        viewBox="0 0 24 24"
        width="10"
        height="10"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  ) : (
    <span className="chat-presence-count">{text}</span>
  )
}
