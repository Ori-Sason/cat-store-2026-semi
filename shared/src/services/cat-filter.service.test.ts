import { describe, expect, it } from 'vitest'
import { DEFAULT_CAT_FILTER } from '../models/cat.ts'
import type { QueryParamsReader } from '../models/util.ts'
import { catFilterService } from './cat-filter.service.ts'

// Shared has no DOM/Node types, so no URLSearchParams here - a minimal reader over [key, value] pairs
function _params(...pairs: [string, string][]): QueryParamsReader {
  return {
    get: (name) => pairs.find(([key]) => key === name)?.[1] ?? null,
    getAll: (name) => pairs.filter(([key]) => key === name).map(([, value]) => value),
  }
}

const { paramsToFilter } = catFilterService

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
