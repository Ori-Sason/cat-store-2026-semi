import type React from 'react'
import { useId, useLayoutEffect, useRef, useState } from 'react'
import { CHAT_MSG_TEXT_MAX_LENGTH, chatMsgSchema } from '@cat-store/shared'
import { chatService } from '../../../services/chat.service'

// The counter shows only near the cap, so a normal msg isn't watched by a number
const _COUNTER_FROM_LENGTH = CHAT_MSG_TEXT_MAX_LENGTH * 0.8

interface ChatComposerProps {
  catId: string
  isDisabled: boolean // until the chat is ready: a send before the join ack would be refused
  onSendMsg: (text: string) => void
}

// The textarea and its round send button. Enter sends, Shift+Enter adds a line.
// No maxLength on the textarea: it would cut a long paste off silently. The text can pass the
// cap, and then the counter turns red and send stays off until the user shortens it.
// It starts from the draft a send left when the session expired (see chatService.saveDraft).
// The caller keys it by cat, so a cat switch starts a fresh composer
export const ChatComposer: React.FC<ChatComposerProps> = ({ catId, isDisabled, onSendMsg }) => {
  const [text, setText] = useState(() => chatService.getDraft(catId) ?? '')
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const counterId = useId()
  // The server's own rule (trimmed, 1 to 1000 chars), so a msg the button allows is never refused
  const isValid = chatMsgSchema.shape.text.safeParse(text).success
  const isCounterShown = text.length > _COUNTER_FROM_LENGTH
  const isOverMax = text.length > CHAT_MSG_TEXT_MAX_LENGTH

  // Grows with the text. The max height and the scroll past it live in the SCSS
  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [text])

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

  // isComposing: Enter also confirms an IME composition (e.g. Japanese input), which isn't a send
  function onKeyDown(ev: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (ev.key !== 'Enter' || ev.shiftKey || ev.nativeEvent.isComposing) return
    ev.preventDefault()
    sendMsg()
  }

  return (
    <form className="chat-composer" noValidate onSubmit={onSubmit}>
      <div className="field">
        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          placeholder="Write a message…"
          aria-label="Message"
          aria-describedby={isCounterShown ? counterId : undefined}
          disabled={isDisabled}
          onChange={(ev) => setText(ev.target.value)}
          onKeyDown={onKeyDown}
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
      {isCounterShown && (
        <p id={counterId} className={`counter ${isOverMax ? 'is-over' : ''}`}>
          {text.length} / {CHAT_MSG_TEXT_MAX_LENGTH}
        </p>
      )}
    </form>
  )
}
