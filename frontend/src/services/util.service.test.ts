import { describe, expect, it } from 'vitest'
import { utilService } from './util.service'

describe('utilService.formatPrice', () => {
  it('drops the cents for a whole price', () => {
    expect(utilService.formatPrice(120)).toBe('$120')
  })

  it('shows two decimals otherwise', () => {
    expect(utilService.formatPrice(95.5)).toBe('$95.50')
  })

  it('groups thousands', () => {
    expect(utilService.formatPrice(1250)).toBe('$1,250')
  })
})

describe('utilService.getFitCount', () => {
  const { getFitCount } = utilService
  const GAP = 4
  const MORE_WIDTH = 30

  it('fits every item when there is room', () => {
    expect(getFitCount([50, 50, 50], 200, GAP, MORE_WIDTH)).toBe(3)
  })

  it('fits the last item without reserving room for "+N"', () => {
    // 50 + 4 + 50 + 4 + 50 = 158, exactly the row
    expect(getFitCount([50, 50, 50], 158, GAP, MORE_WIDTH)).toBe(3)
  })

  it('stops early so "+N" still fits after the shown items', () => {
    // 2 items + "+N" = 50 + 4 + 50 + 4 + 30 = 138; a 3rd item would need 54 more
    expect(getFitCount([50, 50, 50, 50], 150, GAP, MORE_WIDTH)).toBe(2)
  })

  it('drops an item that fits on its own but not next to "+N"', () => {
    // item 2 ends at 104, but 104 + 4 + 30 > 120
    expect(getFitCount([50, 50, 50], 120, GAP, MORE_WIDTH)).toBe(1)
  })

  it('returns 0 when not even one item fits next to "+N"', () => {
    expect(getFitCount([80, 50], 100, GAP, MORE_WIDTH)).toBe(0)
  })

  it('returns 0 for no items', () => {
    expect(getFitCount([], 100, GAP, MORE_WIDTH)).toBe(0)
  })
})
