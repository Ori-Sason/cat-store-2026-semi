import type React from 'react'
import { useEffect, useRef } from 'react'
import { useChatText } from '../../../../hooks/use-chat-text'
import { ChatMsgStatus } from './chat-msg-status'
import { ChatTextCounter } from '../chat-common/chat-text-counter'

interface ChatMsgEditProps {
  initialText: string
  isSaving: boolean // waiting on the ack: the text stays, read-only, with "Saving edit…"
  onSave: (text: string) => void
  onCancel: () => void
}

// The inline editor a msg row turns into. Enter saves, Shift+Enter adds a line (useChatText),
// Escape cancels. The caller keeps it open after a failed save, so the typed text isn't lost
export const ChatMsgEdit: React.FC<ChatMsgEditProps> = ({
  initialText,
  isSaving,
  onSave,
  onCancel,
}) => {
  const formRef = useRef<HTMLFormElement>(null)
  const { text, isValid, textareaRef, textareaProps, counterProps } = useChatText({
    initialText,
    onEnter: save,
  })

  // It opens from the ⋮ menu, which unmounts: focus the text, with the caret at its end. Again
  // after a failed save, since a click on Save left the focus on a button that was disabled
  useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea || isSaving) return
    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
  }, [isSaving, textareaRef])

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

  // Escape stops here: the panel closes on an Escape that reaches it
  function onKeyDown(ev: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (ev.key !== 'Escape') return textareaProps.onKeyDown(ev)
    ev.stopPropagation()
    if (!isSaving) onCancel()
  }

  return (
    <form ref={formRef} className="chat-msg-edit" noValidate onSubmit={onSubmit}>
      <textarea
        rows={1}
        aria-label="Edit message"
        // Read-only, not disabled: a disabled textarea drops the focus
        readOnly={isSaving}
        {...textareaProps}
        onKeyDown={onKeyDown}
      />
      <div className="edit-foot">
        {isSaving && <ChatMsgStatus label="Saving edit…" />}
        {counterProps && <ChatTextCounter {...counterProps} />}
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
