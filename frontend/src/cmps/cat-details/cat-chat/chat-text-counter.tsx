import type React from 'react'
import { CHAT_MSG_TEXT_MAX_LENGTH } from '@cat-store/shared'

interface ChatTextCounterProps {
  id: string // the textarea's aria-describedby points here
  length: number
}

// "n / 1000" under a chat textarea, red past the cap. useChatText decides when it shows.
// Each parent's SCSS places it
export const ChatTextCounter: React.FC<ChatTextCounterProps> = ({ id, length }) => {
  const isOverMax = length > CHAT_MSG_TEXT_MAX_LENGTH
  return (
    <p id={id} className={`chat-text-counter ${isOverMax ? 'is-over' : ''}`}>
      {length} / {CHAT_MSG_TEXT_MAX_LENGTH}
    </p>
  )
}
