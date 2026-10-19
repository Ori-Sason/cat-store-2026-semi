import type React from 'react'

interface ChatJoinErrorProps {
  onRetry: () => void
}

// In the log's place when the join or the first page fails. Retry joins again, then refetches
export const ChatJoinError: React.FC<ChatJoinErrorProps> = ({ onRetry }) => {
  return (
    <div className="chat-join-error" role="alert">
      {/* A crossed-out plug: the connection, not the msgs, is what failed */}
      <svg
        viewBox="0 0 24 24"
        width="40"
        height="40"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <path d="M2 2l20 20M9 2v4M15 2v4M6 10V6h12v4a6 6 0 0 1-1.5 4M12 18v4M8.5 14.5A6 6 0 0 0 12 18" />
      </svg>
      <p className="error-title">Couldn't connect to the chat.</p>
      <p>Check your connection and try again.</p>
      <button type="button" className="main-btn" onClick={onRetry}>
        Retry
      </button>
    </div>
  )
}
