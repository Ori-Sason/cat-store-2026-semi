import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { chatPermissionService, type ChatMsg } from '@cat-store/shared'
import type { ChatMsgBusyAction } from '../../../../hooks/cat-chat/use-cat-chat/chat-state'
import type { PendingChatMsg } from '../../../../models/chat'
import { utilService } from '../../../../services/util.service'
import { useLoggedInUserStore } from '../../../../store/logged-in-user.store'
import { UserChips } from '../../../common/user/user-chips'
import { ActionsMenu } from '../../../common/util/actions-menu'
import { ChatMsgEdit } from './chat-msg-edit'
import { ChatMsgNotSent } from './chat-msg-not-sent'
import { ChatMsgStatus } from './chat-msg-status'

interface ChatMsgPreviewProps {
  msg: ChatMsg | PendingChatMsg
  catOwnerId: string
  onRetry?: () => void // a failed pending msg's "Tap to retry"
  busyAction?: ChatMsgBusyAction // waiting on an edit or remove ack
  onUpdate?: (text: string) => Promise<boolean> // resolves to whether the edit was saved
  onRemove?: () => void // asks for the delete confirm
}

// One row of the chat log: the review row's look (bold name + chips + muted time, the text
// below), made live. A pending msg (an own send the server hasn't confirmed) uses the same row,
// with "Sending…" or a failed line. A saved msg gets the ⋮ menu when the viewer may edit or delete
// it, and turns into the inline editor on Edit
export const ChatMsgPreview: React.FC<ChatMsgPreviewProps> = ({
  msg,
  catOwnerId,
  onRetry,
  busyAction,
  onUpdate,
  onRemove,
}) => {
  const loggedInUser = useLoggedInUserStore((state) => state.loggedInUser)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const menuBtnRef = useRef<HTMLButtonElement>(null)
  const isFocusToMenuRef = useRef(false)
  const { user } = msg
  const sendStatus = 'sendStatus' in msg ? msg.sendStatus : null
  // A guest owns nothing, and a msg whose author is gone (user: null) is nobody's own. Without the
  // loggedInUser check, undefined === undefined would mark a deleted author's msg as a guest's own
  const isOwn = !!user && !!loggedInUser && user._id === loggedInUser._id
  const isEdited = !msg.isDeleted && msg.updatedAt > msg.createdAt
  // Only a saved msg can change: a pending one has no _id yet, and a tombstone is final
  const isSaved = !sendStatus && !msg.isDeleted
  const authorId = user?._id ?? null
  const isEditable = isSaved && chatPermissionService.canEditChatMsg(authorId, loggedInUser)
  const isRemovable = isSaved && chatPermissionService.canRemoveChatMsg(authorId, loggedInUser)
  // Closes by itself when the viewer can no longer edit: a logout, or someone deleted the msg
  const isEditing = isEditOpen && isEditable
  const stateClass = _getStateClass(sendStatus, busyAction)
  // "Saving edit…" sits in the editor, which stays open until the ack
  const statusLabel = _getStatusLabel(sendStatus, busyAction)

  // The focused control unmounts with the editor, which drops the focus to <body>: then the panel
  // no longer gets Escape. Give it back to the ⋮ the editor opened from. Only on the user's close:
  // when the editor closes by itself (a logout, a delete meanwhile), this row has no ⋮ to focus
  useEffect(() => {
    if (isEditOpen || !isFocusToMenuRef.current) return
    isFocusToMenuRef.current = false
    menuBtnRef.current?.focus()
  }, [isEditOpen])

  function closeEdit() {
    isFocusToMenuRef.current = true
    setIsEditOpen(false)
  }

  // A failed save keeps the editor open with the typed text. A saved one's busy state clears
  // before onUpdate resolves, so the ⋮ is enabled again by the time it takes the focus
  async function onSave(text: string) {
    if (await onUpdate?.(text)) closeEdit()
  }

  return (
    <article
      className={`chat-msg-preview ${isOwn ? 'is-own' : ''} ${stateClass}`}
      aria-busy={!!busyAction}
    >
      {isRemovable && !isEditing && (
        <ActionsMenu
          label="Message actions"
          isDisabled={!!busyAction}
          // The author only. An admin on someone else's msg gets Delete alone
          onEdit={isEditable ? () => setIsEditOpen(true) : undefined}
          onDelete={() => onRemove?.()}
          menuBtnRef={menuBtnRef}
        />
      )}
      <header>
        {user ? (
          <span className="author">
            {user.fullname}
            {/* The own-row rail and tint are visual only */}
            {isOwn && <span className="visually-hidden"> (you)</span>}
          </span>
        ) : (
          <span className="author is-gone">[Deleted User]</span>
        )}

        {/* No You chip, on purpose, unlike reviews: a review is a standalone post, while in a
            live conversation the own-row style is enough to find your own lines */}
        {user && (
          <UserChips isAdmin={user.isAdmin} isOwner={user._id === catOwnerId} isYou={false} />
        )}

        <time dateTime={new Date(msg.createdAt).toISOString()}>
          {utilService.formatTime(msg.createdAt)}
        </time>
      </header>

      {msg.isDeleted ? (
        <p className="tombstone">Message deleted</p>
      ) : isEditing ? (
        <ChatMsgEdit
          initialText={msg.text}
          isSaving={busyAction === 'updating'}
          onSave={(text) => void onSave(text)}
          onCancel={closeEdit}
        />
      ) : (
        <p className="text">
          <span className="words">{msg.text}</span>
          {statusLabel && (
            <>
              {' '}
              <ChatMsgStatus label={statusLabel} />
            </>
          )}
        </p>
      )}

      {isEdited && !isEditing && (
        <p className="edited">Edited at {utilService.formatTime(msg.updatedAt)}</p>
      )}

      {sendStatus === 'failed' && <ChatMsgNotSent isRetryable={isOwn} onRetry={onRetry} />}
    </article>
  )
}

function _getStateClass(
  sendStatus: PendingChatMsg['sendStatus'] | null,
  busyAction: ChatMsgBusyAction | undefined,
) {
  if (sendStatus === 'sending') return 'is-pending'
  if (sendStatus === 'failed') return 'is-failed'
  return busyAction ? 'is-busy' : ''
}

function _getStatusLabel(
  sendStatus: PendingChatMsg['sendStatus'] | null,
  busyAction: ChatMsgBusyAction | undefined,
) {
  if (sendStatus === 'sending') return 'Sending…'
  return busyAction === 'removing' ? 'Deleting…' : null
}
