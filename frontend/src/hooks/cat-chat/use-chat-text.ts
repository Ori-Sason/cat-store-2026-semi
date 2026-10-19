import type React from 'react'
import { useId, useLayoutEffect, useRef } from 'react'
import { CHAT_MSG_TEXT_MAX_LENGTH, chatMsgSchema } from '@cat-store/shared'

// The counter shows only near the cap, so a normal msg isn't watched by a number
const _COUNTER_FROM_LENGTH = CHAT_MSG_TEXT_MAX_LENGTH * 0.8

interface UseChatTextOptions {
  // Controlled: the caller owns the text. The composer's lives in CatChat, so it outlives the
  // closed panel, and a caller can react to each change (e.g. the typing indicator)
  text: string
  onTextChange: (text: string) => void
  // Enter, without Shift and outside an IME composition. The caller decides if it sends
  onEnter: () => void
}

// The textarea behavior the chat composer and the inline edit share: the text, its validity,
// the auto-grow, the counter near the cap, and Enter to submit (Shift+Enter adds a line).
// No maxLength: it would cut a long paste off silently. The text can pass the cap, and then the
// counter turns red and the caller keeps its submit button off (isValid is false)
export function useChatText({ text, onTextChange, onEnter }: UseChatTextOptions) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const counterId = useId()
  const isValid = chatMsgSchema.shape.text.safeParse(text).success
  const isCounterShown = text.length > _COUNTER_FROM_LENGTH

  // Grows with the text. The max height and the scroll past it live in the SCSS
  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [text])

  // isComposing: Enter also confirms an IME composition (e.g. Japanese input), which isn't a submit
  function onKeyDown(ev: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (ev.key !== 'Enter' || ev.shiftKey || ev.nativeEvent.isComposing) return
    ev.preventDefault()
    onEnter()
  }

  return {
    isValid,
    textareaRef,
    // Spread on the <textarea>. A caller that handles more keys wraps onKeyDown
    textareaProps: {
      ref: textareaRef,
      value: text,
      onChange: (ev: React.ChangeEvent<HTMLTextAreaElement>) => onTextChange(ev.target.value),
      onKeyDown,
      'aria-describedby': isCounterShown ? counterId : undefined,
    },
    // Spread on <ChatTextCounter />, null while it's hidden
    counterProps: isCounterShown ? { id: counterId, length: text.length } : null,
  }
}
