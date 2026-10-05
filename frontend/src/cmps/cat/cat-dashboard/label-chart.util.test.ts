import type { CatLabelStats } from '@cat-store/shared'
import { describe, expect, it } from 'vitest'
import {
  formatPriceStats,
  formatStockStats,
  getPriceAxis,
  type PriceAxis,
  toPriceChartRows,
  toStockChartRows,
} from './label-chart.util'

function _stats(overrides: Partial<CatLabelStats> = {}): CatLabelStats {
  return {
    label: 'Kitten',
    count: 3,
    inStockCount: 2,
    medianPrice: 100,
    minPrice: 70,
    maxPrice: 180,
    ...overrides,
  }
}

function _tickValues(axis: PriceAxis) {
  return axis.ticks.map((t) => t.value)
}

const _EMPTY = _stats({
  label: 'Senior',
  count: 0,
  inStockCount: 0,
  medianPrice: null,
  minPrice: null,
  maxPrice: null,
})

describe('getPriceAxis', () => {
  it('rounds the top price up to nice steps', () => {
    const axis = getPriceAxis([_stats({ maxPrice: 2494 }), _stats({ maxPrice: 800 })])

    expect(axis.max).toBe(2500)
    expect(_tickValues(axis)).toEqual([0, 500, 1000, 1500, 2000, 2500])
  })

  it('picks a step of 2 × 10ⁿ when 1 × 10ⁿ is too small', () => {
    const axis = getPriceAxis([_stats({ maxPrice: 95.5 })])

    expect(axis.max).toBe(100)
    expect(_tickValues(axis)).toEqual([0, 20, 40, 60, 80, 100])
  })

  it('keeps a top price that is already on a step', () => {
    expect(getPriceAxis([_stats({ maxPrice: 200 })]).max).toBe(200)
  })

  it('skips labels with no cats, and gives a flat axis when none have prices', () => {
    expect(getPriceAxis([_EMPTY, _stats({ maxPrice: 180 })]).max).toBe(200)
    expect(getPriceAxis([_EMPTY])).toEqual({ max: 0, ticks: [{ value: 0, pct: 0 }] })
  })

  it('places each tick as % of the axis max', () => {
    const axis = getPriceAxis([_stats({ maxPrice: 200 })])

    expect(axis.ticks.map((t) => t.pct)).toEqual([0, 25, 50, 75, 100])
  })
})

describe('toPriceChartRows', () => {
  it('places the median, min and max as % of the axis max', () => {
    expect(toPriceChartRows([_stats()], 200)).toEqual([
      { ..._stats(), pricePcts: { median: 50, min: 35, max: 90 } },
    ])
  })

  it('gives no positions for a label with no cats', () => {
    expect(toPriceChartRows([_EMPTY], 200)).toEqual([{ ..._EMPTY, pricePcts: null }])
  })
})

describe('toStockChartRows', () => {
  it('splits the count into in-stock and out-of-stock percents', () => {
    const row = _stats({ count: 4, inStockCount: 3 })

    expect(toStockChartRows([row])).toEqual([{ ...row, inStockPct: 75, outOfStockPct: 25 }])
  })

  it('rounds the in-stock percent and keeps the sum at 100', () => {
    const [row] = toStockChartRows([_stats({ count: 3, inStockCount: 1 })])

    expect(row).toMatchObject({ inStockPct: 33, outOfStockPct: 67 })
  })

  it('handles all in stock and none in stock', () => {
    const rows = toStockChartRows([
      _stats({ count: 2, inStockCount: 2 }),
      _stats({ count: 2, inStockCount: 0 }),
    ])

    expect(rows[0]).toMatchObject({ inStockPct: 100, outOfStockPct: 0 })
    expect(rows[1]).toMatchObject({ inStockPct: 0, outOfStockPct: 100 })
  })

  it('gives 0 / 0 for a label with no cats', () => {
    expect(toStockChartRows([_EMPTY])).toEqual([{ ..._EMPTY, inStockPct: 0, outOfStockPct: 0 }])
  })
})

describe('formatPriceStats', () => {
  it('shows the median, the range and the count', () => {
    expect(formatPriceStats(_stats({ minPrice: 70, maxPrice: 1250.5 }))).toBe(
      '$100 · $70–$1,250.50 · 3 cats',
    )
  })

  it('says "cat" for a single cat', () => {
    const one = _stats({ count: 1, medianPrice: 50, minPrice: 50, maxPrice: 50 })

    expect(formatPriceStats(one)).toBe('$50 · $50–$50 · 1 cat')
  })

  it('says "No cats" for an empty label', () => {
    expect(formatPriceStats(_EMPTY)).toBe('No cats')
  })
})

describe('formatStockStats', () => {
  it('shows the in-stock count and percent', () => {
    const [row] = toStockChartRows([_stats({ count: 27, inStockCount: 15 })])

    expect(formatStockStats(row)).toBe('15 / 27 in stock · 56%')
  })

  it('says "No cats" for an empty label', () => {
    const [row] = toStockChartRows([_EMPTY])

    expect(formatStockStats(row)).toBe('No cats')
  })
})
