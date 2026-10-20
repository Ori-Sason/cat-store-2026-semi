import type { UserRef } from '@cat-store/shared'
import type React from 'react'
import { useEffect, useId, useRef } from 'react'
import { UserChips } from '../../../common/user/user-chips'

interface ChatPresenceListProps {
  users: UserRef[] // the server's snapshot, in join order
  loggedInUserId: string
  catOwnerId: string // for the Owner chip
  onBack: () => void
}

// "Who's here", in the panel body's place. The header stays, with its live count and ×.
// Unlike the log, rows show the You chip: a list has no own-row rail to mark the viewer
export const ChatPresenceList: React.FC<ChatPresenceListProps> = ({
  users,
  loggedInUserId,
  catOwnerId,
  onBack,
}) => {
  const backBtnRef = useRef<HTMLButtonElement>(null)
  const titleId = useId()

  // The list replaces the body, so the focus starts at its only control
  useEffect(() => {
    backBtnRef.current?.focus()
  }, [])

  return (
    <section className="chat-presence-list" aria-labelledby={titleId}>
      <button ref={backBtnRef} type="button" className="back-btn" onClick={onBack}>
        <svg
          viewBox="0 0 24 24"
          width="11"
          height="11"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M15 6l-6 6 6 6" />
        </svg>
        Back to chat
      </button>
      <h3 id={titleId}>Here now</h3>
      <ul className="clean-list">
        {_sortUsers(users, loggedInUserId).map((user) => (
          <li key={user._id}>
            <span className="name">{user.fullname}</span>
            <UserChips
              isAdmin={user.isAdmin}
              isOwner={user._id === catOwnerId}
              isYou={user._id === loggedInUserId}
            />
          </li>
        ))}
      </ul>
    </section>
  )
}

// You first, then everyone else by name. The server sends join order, which means nothing to a
// reader
function _sortUsers(users: UserRef[], loggedInUserId: string) {
  return users.toSorted((a, b) => {
    if (a._id === loggedInUserId) return -1
    if (b._id === loggedInUserId) return 1
    return a.fullname.localeCompare(b.fullname)
  })
}
