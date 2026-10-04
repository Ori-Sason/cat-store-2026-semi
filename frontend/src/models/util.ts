export interface UserMsg {
  id: number
  txt: string
  type: 'success' | 'error'
}

// Set by a cat-preview link, so details can go back to the list with the same filter
export interface CatListLocationState {
  listSearch: string
}
