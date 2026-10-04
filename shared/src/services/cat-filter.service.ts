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

// CatFilter → query string, the inverse of paramsToFilter. Returns [key, value] pairs,
// since shared has no URLSearchParams - `new URLSearchParams(pairs)` takes them as is.
// Labels go out as repeated keys (labels=Kitten&labels=Calm), the shape the BE reads.
// Values equal to DEFAULT_CAT_FILTER are left out, so the default filter is an empty query
function filterToParams(filter: CatFilter): [string, string][] {
  const pairs: [string, string][] = []
  const txt = filter.txt.trim()
  if (txt) pairs.push(['txt', txt])
  if (filter.isInStock !== null) pairs.push(['isInStock', String(filter.isInStock)])
  for (const label of filter.labels) pairs.push(['labels', label])
  if (filter.sortBy !== DEFAULT_CAT_FILTER.sortBy) pairs.push(['sortBy', filter.sortBy])
  if (filter.sortDir !== DEFAULT_CAT_FILTER.sortDir) pairs.push(['sortDir', filter.sortDir])
  return pairs
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
  filterToParams,
}
