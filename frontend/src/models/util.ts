export interface UserMsg {
  id: number
  txt: string
  type: 'success' | 'error'
}

// Set by links into a cat's pages (a cat card, a review row's cat, "+ Add cat") and passed on
// through edit, so Back and Cancel return to the page they came from: the list with its filter,
// home, or a user page. Location state, not a URL param: it lives in the history entry, so only
// the app's own links can set it
export interface BackToLocationState {
  backTo: string // pathname + search
}
