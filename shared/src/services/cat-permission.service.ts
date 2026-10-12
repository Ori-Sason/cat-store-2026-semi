import type { Cat } from '../models/cat.ts'
import type { LoggedInUserOrGuest } from '../models/user.ts'

// The cat rules (roadmap Part 4). The FE uses them to decide which Add / Edit / Delete
// options to show. The BE enforces edit / delete through canEditCat (requireCatOwner), and add
// with requireAuth, which checks the same thing.
// The FE answers from the logged-in user it hydrated, which can be stale, so only the BE's
// answer (with a verified user) is a real guard

function canAddCat(loggedInUser: LoggedInUserOrGuest): boolean {
  return !!loggedInUser
}

// Edit and delete: the cat's owner, or any admin. Takes the owner's id alone, so each caller
// passes it from its own shape: a CatDoc's ownerId, or a CatWithRefs's owner._id
function canEditCat(catOwnerId: Cat['ownerId'], loggedInUser: LoggedInUserOrGuest): boolean {
  if (!loggedInUser) return false
  return loggedInUser.isAdmin || catOwnerId === loggedInUser._id
}

export const catPermissionService = {
  canAddCat,
  canEditCat,
}
