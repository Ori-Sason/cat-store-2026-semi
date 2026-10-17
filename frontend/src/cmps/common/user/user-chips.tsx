import type React from 'react'

interface UserChipsProps {
  isAdmin: boolean
  isOwner: boolean
  isYou: boolean
}

// Presentational only: it owns the order, the labels and the look. Each caller decides which
// flags to pass, since the rules differ (a review row hides You and Admin on a user's page, and
// chat never shows You)
export const UserChips: React.FC<UserChipsProps> = ({ isAdmin, isOwner, isYou }) => {
  // No empty wrapper, so the parent's gap doesn't leave a hole when there's nothing to show
  if (!isAdmin && !isOwner && !isYou) return null

  return (
    <span className="user-chips">
      {isAdmin && <span className="chip admin">Admin</span>}
      {isOwner && <span className="chip owner">Owner</span>}
      {isYou && <span className="chip">You</span>}
    </span>
  )
}
