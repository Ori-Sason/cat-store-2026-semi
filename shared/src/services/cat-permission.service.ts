import type { Cat } from '../models/cat.ts'
import type { LoggedInUser } from '../models/user.ts'

// The cat rules (roadmap Part 4). The FE hides what fails them. The BE enforces edit / delete
// through canEditCat (requireCatOwner), and add with requireAuth, which checks the same thing.

// null = a guest. The FE answers from the logged-in user it hydrated, which can be stale,
// so only the BE's answer (with a verified user) is a real guard
type _LoggedInUserOrGuest = Pick<LoggedInUser, '_id' | 'isAdmin'> | null

function canAddCat(loggedInUser: _LoggedInUserOrGuest): boolean {
  return !!loggedInUser
}

// Edit and delete: the cat's owner, or any admin
function canEditCat(cat: Pick<Cat, 'ownerId'>, loggedInUser: _LoggedInUserOrGuest): boolean {
  if (!loggedInUser) return false
  return loggedInUser.isAdmin || cat.ownerId === loggedInUser._id
}

export const catPermissionService = {
  canAddCat,
  canEditCat,
}
