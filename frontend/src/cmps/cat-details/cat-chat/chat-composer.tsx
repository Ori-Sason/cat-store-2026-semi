import type React from 'react'
import { useChatText } from '../../../hooks/use-chat-text'
import { chatService } from '../../../services/chat.service'
import { ChatTextCounter } from './chat-text-counter'

interface ChatComposerProps {
  catId: string
  isDisabled: boolean // until the chat is ready: a send before the join ack would be refused
  onSendMsg: (text: string) => void
}

// The textarea and its round send button. Enter sends, Shift+Enter adds a line (useChatText).
// It starts from the draft a send left when the session expired (see chatService.saveDraft).
// The caller keys it by cat, so a cat switch starts a fresh composer
export const ChatComposer: React.FC<ChatComposerProps> = ({ catId, isDisabled, onSendMsg }) => {
  const { text, setText, isValid, textareaRef, textareaProps, counterProps } = useChatText({
    initialText: () => chatService.getDraft(catId) ?? '',
    onEnter: sendMsg,
  })

  function sendMsg() {
    if (isDisabled || !isValid) return
    onSendMsg(text.trim())
    setText('')
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
