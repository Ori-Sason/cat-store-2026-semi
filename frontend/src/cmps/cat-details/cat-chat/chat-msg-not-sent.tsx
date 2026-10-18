import type React from 'react'

interface ChatMsgNotSentProps {
  isRetryable: boolean
  onRetry?: () => void
}

// The red line under a failed pending msg. Only its author can retry: after a logout the row
// stays with its text, and this is a plain "Not sent" with nothing to tap
export const ChatMsgNotSent: React.FC<ChatMsgNotSentProps> = ({ isRetryable, onRetry }) => {
  if (!isRetryable) return <p className="chat-msg-not-sent">Not sent</p>

  return (
    <button type="button" className="chat-msg-not-sent" onClick={onRetry}>
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6M12 16.5v.5" />
      </svg>
      Not sent. Tap to retry
    </button>
  )
}
