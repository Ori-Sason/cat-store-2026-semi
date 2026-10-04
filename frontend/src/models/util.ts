export interface UserMsg {
  id: number
  txt: string
  type: 'success' | 'error'
}

// Set by links that leave the list (a cat-preview, "+ Add cat") and passed on through edit,
// so Back and Cancel can return to the list with the same filter
export interface CatListLocationState {
  listSearch: string
}
