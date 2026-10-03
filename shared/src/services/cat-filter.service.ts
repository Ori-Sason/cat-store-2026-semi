import {
  CAT_LABELS,
  CAT_SORT_FIELDS,
  DEFAULT_CAT_FILTER,
  type CatFilter,
  type CatLabel,
} from '../models/cat.ts'
import type { QueryParamsReader, SortByDirection } from '../models/util.ts'

const _SORT_DIRS: readonly SortByDirection[] = ['asc', 'desc']

// Query string → CatFilter. The FE loader and the BE controller both call this,
// so the two sides can't disagree on what a URL means.
// Softy on purpose: a hand-edited URL with a bad value falls back to the default instead of a 400
function paramsToFilter(params: QueryParamsReader): CatFilter {
  return {
    txt: params.get('txt')?.trim() ?? DEFAULT_CAT_FILTER.txt,
    isInStock: _parseBoolean(params.get('isInStock')),
    labels: _parseLabels(params.getAll('labels')),
    sortBy: _pickOne(params.get('sortBy'), CAT_SORT_FIELDS) ?? DEFAULT_CAT_FILTER.sortBy,
    sortDir: _pickOne(params.get('sortDir'), _SORT_DIRS) ?? DEFAULT_CAT_FILTER.sortDir,
  }
}

function _parseBoolean(value: string | null): boolean | null {
  if (value === 'true') return true
  if (value === 'false') return false
  return null
}

// CAT_LABELS order, deduped - the same labels in any order give the same filter
function _parseLabels(values: string[]): CatLabel[] {
  return CAT_LABELS.filter((label) => values.includes(label))
}

function _pickOne<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return allowed.find((option) => option === value)
}

export const catFilterService = {
  paramsToFilter,
}
