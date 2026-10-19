import type React from 'react'
import { useChatText } from '../../../../hooks/cat-chat/use-chat-text'
import { chatService } from '../../../../services/chat.service'
import { ChatTextCounter } from '../chat-common/chat-text-counter'

interface ChatComposerProps {
  catId: string
  // Owned by CatChat, so closing the panel (which unmounts this) keeps what was typed
  text: string
  onTextChange: (text: string) => void
  isDisabled: boolean // until the chat is ready: a send before the join ack would be refused
  onSendMsg: (text: string) => void
}

// The textarea and its round send button. Enter sends, Shift+Enter adds a line (useChatText)
export const ChatComposer: React.FC<ChatComposerProps> = ({
  catId,
  text,
  onTextChange,
  isDisabled,
  onSendMsg,
}) => {
  const { isValid, textareaRef, textareaProps, counterProps } = useChatText({
    text,
    onTextChange,
    onEnter: sendMsg,
  })

  function sendMsg() {
    if (isDisabled || !isValid) return
    onSendMsg(text.trim())
    onTextChange('')
    // Sent as a new msg now, so it shouldn't come back on the next visit
    chatService.removeDraft(catId)
    // A click on send leaves focus on the button, which the empty text then disables
    textareaRef.current?.focus()
  }

  function onSubmit(ev: React.SubmitEvent<HTMLFormElement>) {
    ev.preventDefault()
    sendMsg()
  }

  return (
    <form className="chat-composer" noValidate onSubmit={onSubmit}>
      <div className="field">
        <textarea
          rows={1}
          placeholder="Write a message…"
          aria-label="Message"
          disabled={isDisabled}
          {...textareaProps}
        />
        <button type="submit" className="send" aria-label="Send" disabled={isDisabled || !isValid}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 19V5M5 12l7-7 7 7" />
          </svg>
        </button>
      </div>
      {counterProps && <ChatTextCounter {...counterProps} />}
    </form>
  )
}
