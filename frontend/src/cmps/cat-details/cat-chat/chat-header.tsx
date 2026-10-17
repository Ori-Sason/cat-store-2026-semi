import type React from 'react'

interface ChatHeaderProps {
  titleId: string // the panel's aria-labelledby points at the title
  catName: string
  onClose: () => void
}

// Only a ×, no minimize: closing already only hides the panel
export const ChatHeader: React.FC<ChatHeaderProps> = ({ titleId, catName, onClose }) => {
  return (
    <header className="chat-header">
      <div className="title">
        <h2 id={titleId}>Chat</h2>
        <p>About {catName}</p>
      </div>
      <button type="button" className="close-btn" aria-label="Close chat" onClick={onClose}>
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
  )
}
