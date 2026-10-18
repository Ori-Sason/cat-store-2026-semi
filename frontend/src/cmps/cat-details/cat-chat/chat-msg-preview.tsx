import type React from 'react'
import type { ChatMsg } from '@cat-store/shared'
import type { PendingChatMsg } from '../../../models/chat'
import { utilService } from '../../../services/util.service'
import { useLoggedInUserStore } from '../../../store/logged-in-user.store'
import { UserChips } from '../../common/user/user-chips'
import { ChatMsgNotSent } from './chat-msg-not-sent'
import { ChatMsgStatus } from './chat-msg-status'

interface ChatMsgPreviewProps {
  msg: ChatMsg | PendingChatMsg
  catOwnerId: string
  onRetry?: () => void // a failed pending msg's "Tap to retry"
}

// One row of the chat log: the review row's look (bold name + chips + muted time, the text
// below), made live. A pending msg (an own send the server hasn't confirmed) uses the same row,
// with "Sending…" or a failed line
export const ChatMsgPreview: React.FC<ChatMsgPreviewProps> = ({ msg, catOwnerId, onRetry }) => {
  const loggedInUser = useLoggedInUserStore((state) => state.loggedInUser)
  const { user } = msg
  const sendStatus = 'sendStatus' in msg ? msg.sendStatus : null
  // A guest owns nothing, and a msg whose author is gone (user: null) is nobody's own. Without the
  // loggedInUser check, undefined === undefined would mark a deleted author's msg as a guest's own
  const isOwn = !!user && !!loggedInUser && user._id === loggedInUser._id
  const isEdited = !msg.isDeleted && msg.updatedAt > msg.createdAt
  const stateClass = sendStatus ? `is-${sendStatus === 'sending' ? 'pending' : 'failed'}` : ''

  return (
    <article className={`chat-msg-preview ${isOwn ? 'is-own' : ''} ${stateClass}`}>
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
      ) : (
        <p className="text">
          <span className="words">{msg.text}</span>
          {sendStatus === 'sending' && (
            <>
              {' '}
              <ChatMsgStatus label="Sending…" />
            </>
          )}
        </p>
      )}
      {isEdited && <p className="edited">Edited at {utilService.formatTime(msg.updatedAt)}</p>}
      {sendStatus === 'failed' && <ChatMsgNotSent isRetryable={isOwn} onRetry={onRetry} />}
    </article>
  )
}
