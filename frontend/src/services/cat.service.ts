import {
  catFilterService,
  DEFAULT_CAT_FILTER,
  type Cat,
  type CatFilter,
  type CatInput,
} from '@cat-store/shared'
import { httpService } from './http.service'

const BASE_PATH = 'cats'

export const catService = {
  query,
  getById,
  save,
  remove,
}

// URLSearchParams, not a plain object: axios sends it as is, so labels go out as
// repeated keys (labels=Kitten&labels=Calm) instead of axios's labels[]=…
function query(filterBy: CatFilter = DEFAULT_CAT_FILTER): Promise<Cat[]> {
  const params = new URLSearchParams(catFilterService.filterToParams(filterBy))
  return httpService.get<Cat[]>(BASE_PATH, params)
}

function getById(catId: string): Promise<Cat> {
  return httpService.get<Cat>(`${BASE_PATH}/${catId}`)
}

// A whole Cat is fine on PUT - the BE strips _id, createdAt and updatedAt
function save(cat: CatInput & Partial<Pick<Cat, '_id'>>): Promise<Cat> {
  if (cat._id) return httpService.put<Cat>(`${BASE_PATH}/${cat._id}`, cat)
  return httpService.post<Cat>(BASE_PATH, cat)
}

function remove(catId: string): Promise<void> {
  return httpService.delete<void>(`${BASE_PATH}/${catId}`)
}
