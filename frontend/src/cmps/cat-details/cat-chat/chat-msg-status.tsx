import type React from 'react'

interface ChatMsgStatusProps {
  label: string // "Sending…" (and, with edit and remove, "Saving edit…" / "Deleting…")
}

// The in-flight note after a msg's text: a small rolling spinner and a label. The spinner stands
// still under reduced motion
export const ChatMsgStatus: React.FC<ChatMsgStatusProps> = ({ label }) => {
  return (
    <span className="chat-msg-status">
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M12 3a9 9 0 1 0 9 9" />
      </svg>
      {label}
    </span>
  )
}
