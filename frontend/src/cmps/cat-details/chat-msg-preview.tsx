import type React from 'react'
import type { ChatMsg } from '@cat-store/shared'
import { utilService } from '../../services/util.service'
import { useLoggedInUserStore } from '../../store/logged-in-user.store'
import { UserChips } from '../common/user/user-chips'

interface ChatMsgPreviewProps {
  msg: ChatMsg
  catOwnerId: string
}

// One row of the chat log: the review row's look (bold name + chips + muted time, the text
// below), made live
export const ChatMsgPreview: React.FC<ChatMsgPreviewProps> = ({ msg, catOwnerId }) => {
  const loggedInUser = useLoggedInUserStore((state) => state.loggedInUser)
  const { user } = msg
  // A guest owns nothing, and a msg whose author is gone (user: null) is nobody's own. Without the
  // loggedInUser check, undefined === undefined would mark a deleted author's msg as a guest's own
  const isOwn = !!user && !!loggedInUser && user._id === loggedInUser._id
  const isEdited = !msg.isDeleted && msg.updatedAt > msg.createdAt

  return (
    <article className={`chat-msg-preview ${isOwn ? 'is-own' : ''}`}>
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
        <p className="text">{msg.text}</p>
      )}
      {isEdited && <p className="edited">Edited at {utilService.formatTime(msg.updatedAt)}</p>}
    </article>
  )
}
