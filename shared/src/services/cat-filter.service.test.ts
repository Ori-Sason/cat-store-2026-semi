import { describe, expect, it } from 'vitest'
import { DEFAULT_CAT_FILTER, type CatFilter } from '../models/cat.ts'
import type { QueryParamsReader } from '../models/util.ts'
import { catFilterService } from './cat-filter.service.ts'

// Shared has no DOM/Node types, so no URLSearchParams here - a minimal reader over [key, value] pairs
function _params(...pairs: [string, string][]): QueryParamsReader {
  return {
    get: (name) => pairs.find(([key]) => key === name)?.[1] ?? null,
    getAll: (name) => pairs.filter(([key]) => key === name).map(([, value]) => value),
  }
}

const { paramsToFilter, filterToParams } = catFilterService

const _FULL_FILTER: CatFilter = {
  txt: 'tom',
  isInStock: true,
  labels: ['Kitten', 'Calm'],
  sortBy: 'price',
  sortDir: 'asc',
}

describe('catFilterService.paramsToFilter', () => {
  it('returns the default filter for empty params', () => {
    expect(paramsToFilter(_params())).toEqual(DEFAULT_CAT_FILTER)
  })

  it('reads every field', () => {
    const filter = paramsToFilter(
      _params(
        ['txt', 'tom'],
        ['isInStock', 'true'],
        ['labels', 'Kitten'],
        ['labels', 'Calm'],
        ['sortBy', 'price'],
        ['sortDir', 'asc'],
      ),
    )
    expect(filter).toEqual({
      txt: 'tom',
      isInStock: true,
      labels: ['Kitten', 'Calm'],
      sortBy: 'price',
      sortDir: 'asc',
    })
  })

  it('trims txt', () => {
    expect(paramsToFilter(_params(['txt', '  tom  '])).txt).toBe('tom')
  })

  it('reads isInStock=false as false, not as missing', () => {
    expect(paramsToFilter(_params(['isInStock', 'false'])).isInStock).toBe(false)
  })

  it('dedupes labels and puts them in CAT_LABELS order', () => {
    const filter = paramsToFilter(
      _params(['labels', 'Calm'], ['labels', 'Kitten'], ['labels', 'Calm']),
    )
    expect(filter.labels).toEqual(['Kitten', 'Calm'])
  })

  it('drops invalid values instead of throwing', () => {
    const filter = paramsToFilter(
      _params(
        ['isInStock', 'yes'],
        ['labels', 'Dog'],
        ['labels', 'kitten'], // labels are case-sensitive
        ['sortBy', 'ownerId'],
        ['sortDir', 'up'],
      ),
    )
    expect(filter).toEqual(DEFAULT_CAT_FILTER)
  })
})

describe('catFilterService.filterToParams', () => {
  it('returns no params for the default filter', () => {
    expect(filterToParams(DEFAULT_CAT_FILTER)).toEqual([])
  })

  it('writes every field, with labels as repeated keys', () => {
    expect(filterToParams(_FULL_FILTER)).toEqual([
      ['txt', 'tom'],
      ['isInStock', 'true'],
      ['labels', 'Kitten'],
      ['labels', 'Calm'],
      ['sortBy', 'price'],
      ['sortDir', 'asc'],
    ])
  })

  it('keeps isInStock=false, not as missing', () => {
    expect(filterToParams({ ...DEFAULT_CAT_FILTER, isInStock: false })).toEqual([
      ['isInStock', 'false'],
    ])
  })

  it('trims txt and drops a whitespace-only one', () => {
    expect(filterToParams({ ...DEFAULT_CAT_FILTER, txt: '  tom  ' })).toEqual([['txt', 'tom']])
    expect(filterToParams({ ...DEFAULT_CAT_FILTER, txt: '   ' })).toEqual([])
  })

  it('drops sortBy and sortDir one by one when they match the default', () => {
    expect(filterToParams({ ...DEFAULT_CAT_FILTER, sortDir: 'asc' })).toEqual([['sortDir', 'asc']])
  })

  it.each([
    ['the default filter', DEFAULT_CAT_FILTER],
    ['a full filter', _FULL_FILTER],
  ])('round-trips %s through paramsToFilter', (_name, filter) => {
    expect(paramsToFilter(_params(...filterToParams(filter)))).toEqual(filter)
  })
})
