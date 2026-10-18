import type React from 'react'
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { CHAT_MSG_TEXT_MAX_LENGTH, chatMsgUpdateSchema } from '@cat-store/shared'
import { ChatMsgStatus } from './chat-msg-status'

// The counter shows only near the cap, like the composer's
const _COUNTER_FROM_LENGTH = CHAT_MSG_TEXT_MAX_LENGTH * 0.8

interface ChatMsgEditProps {
  initialText: string
  isSaving: boolean // waiting on the ack: the text stays, read-only, with "Saving edit…"
  onSave: (text: string) => void
  onCancel: () => void
}

// The inline editor a msg row turns into. Enter saves, Shift+Enter adds a line, Escape cancels.
// The caller keeps it open after a failed save, so the typed text isn't lost.
// No maxLength, like the composer: past the cap the counter turns red and Save stays off
export const ChatMsgEdit: React.FC<ChatMsgEditProps> = ({
  initialText,
  isSaving,
  onSave,
  onCancel,
}) => {
  const [text, setText] = useState(initialText)
  const formRef = useRef<HTMLFormElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const counterId = useId()
  // The server's own rule, so an edit the button allows is never refused
  const isValid = chatMsgUpdateSchema.shape.text.safeParse(text).success
  const isCounterShown = text.length > _COUNTER_FROM_LENGTH
  const isOverMax = text.length > CHAT_MSG_TEXT_MAX_LENGTH

  // Grows with the text. The max height and the scroll past it live in the SCSS
  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = `${textarea.scrollHeight}px`
  }, [text])

  // It opens from the ⋮ menu, which unmounts: focus the text, with the caret at its end. Again
  // after a failed save, since a click on Save left the focus on a button that was disabled
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea || isSaving) return
    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
  }, [isSaving])

  // The focus scrolls only the textarea into view. On the bottom row, Save and Cancel would sit
  // below the log's fold. Optional call: jsdom has no scrollIntoView
  useEffect(() => {
    formRef.current?.scrollIntoView?.({ block: 'nearest' })
  }, [])

  function save() {
    if (isSaving || !isValid) return
    const trimmedText = text.trim()
    // Nothing changed: no write, and no "Edited at" for an edit that edits nothing
    if (trimmedText === initialText) onCancel()
    else onSave(trimmedText)
  }

  function onSubmit(ev: React.SubmitEvent<HTMLFormElement>) {
    ev.preventDefault()
    save()
  }

  // isComposing: Enter also confirms an IME composition, which isn't a save.
  // Escape stops here: the panel closes on an Escape that reaches it
  function onKeyDown(ev: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (ev.key === 'Escape') {
      ev.stopPropagation()
      if (!isSaving) onCancel()
      return
    }
    if (ev.key !== 'Enter' || ev.shiftKey || ev.nativeEvent.isComposing) return
    ev.preventDefault()
    save()
  }

  return (
    <form ref={formRef} className="chat-msg-edit" noValidate onSubmit={onSubmit}>
      <textarea
        ref={textareaRef}
        rows={1}
        value={text}
        aria-label="Edit message"
        aria-describedby={isCounterShown ? counterId : undefined}
        // Read-only, not disabled: a disabled textarea drops the focus
        readOnly={isSaving}
        onChange={(ev) => setText(ev.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className="edit-foot">
        {isSaving && <ChatMsgStatus label="Saving edit…" />}
        {isCounterShown && (
          <p id={counterId} className={`counter ${isOverMax ? 'is-over' : ''}`}>
            {text.length} / {CHAT_MSG_TEXT_MAX_LENGTH}
          </p>
        )}
        {/* Not .actions: cat-details styles its own .actions, and the chat sits inside it */}
        <div className="edit-btns">
          <button type="button" className="sub-btn" disabled={isSaving} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className="main-btn" disabled={isSaving || !isValid}>
            Save
          </button>
        </div>
      </div>
    </form>
  )
}
