export type SortByDirection = 'asc' | 'desc'

export interface DynamicObj {
  [key: string]: any
}

// The read side of URLSearchParams, typed structurally - shared has no DOM/Node types,
// but a real URLSearchParams (FE or BE) fits it as is
export interface QueryParamsReader {
  get(name: string): string | null
  getAll(name: string): string[]
}
