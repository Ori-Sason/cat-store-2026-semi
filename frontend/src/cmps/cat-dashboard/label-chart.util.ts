import type { CatLabelStats } from '@cat-store/shared'
import { utilService } from '../../services/util.service'

// Aim for about this many steps on the price axis. The exact count follows from the nice step size
const _PRICE_AXIS_STEP_COUNT = 5

// A tick's value, and its position in % of the axis max
export interface PriceAxisTick {
  value: number
  pct: number
}

export interface PriceAxis {
  max: number
  ticks: PriceAxisTick[]
}

// Positions on the price axis, in % of its max. null for a label with no cats
export interface PriceChartRow extends CatLabelStats {
  pricePcts: { median: number; min: number; max: number } | null
}

export interface StockChartRow extends CatLabelStats {
  inStockPct: number
  outOfStockPct: number
}

// Rounds the top price up to whole 1 / 2 / 5 × 10ⁿ steps: 2494 → steps of 500, max 2500
export function getPriceAxis(stats: CatLabelStats[]): PriceAxis {
  const topPrice = Math.max(0, ...stats.map((s) => s.maxPrice ?? 0))
  if (topPrice === 0) return { max: 0, ticks: [{ value: 0, pct: 0 }] }

  const step = _getNiceStep(topPrice / _PRICE_AXIS_STEP_COUNT)
  const stepCount = Math.ceil(topPrice / step)
  const max = stepCount * step
  const ticks = Array.from({ length: stepCount + 1 }, (_, i) => {
    const value = i * step
    return { value, pct: _toPct(value, max) }
  })
  return { max, ticks }
}

export function toPriceChartRows(stats: CatLabelStats[], axisMax: number): PriceChartRow[] {
  return stats.map((stat) => {
    const { medianPrice, minPrice, maxPrice } = stat
    const isHasPrices = medianPrice !== null && minPrice !== null && maxPrice !== null
    return {
      ...stat,
      pricePcts: isHasPrices
        ? {
            median: _toPct(medianPrice, axisMax),
            min: _toPct(minPrice, axisMax),
            max: _toPct(maxPrice, axisMax),
          }
        : null,
    }
  })
}

// out-of-stock is the remainder, not rounded on its own, so the bar always fills 100%
export function toStockChartRows(stats: CatLabelStats[]): StockChartRow[] {
  return stats.map((stat) => {
    if (stat.count === 0) return { ...stat, inStockPct: 0, outOfStockPct: 0 }
    const inStockPct = Math.round((stat.inStockCount / stat.count) * 100)
    return { ...stat, inStockPct, outOfStockPct: 100 - inStockPct }
  })
}

// "median $845 · $193–$2,069 · 27 cats"
export function formatPriceStats(s: CatLabelStats): string {
  if (s.count === 0 || s.medianPrice === null || s.minPrice === null || s.maxPrice === null) {
    return 'No cats'
  }
  const { formatPrice } = utilService
  const range = `${formatPrice(s.minPrice)}–${formatPrice(s.maxPrice)}`
  return `median ${formatPrice(s.medianPrice)} · ${range} · ${_formatCatCount(s.count)}`
}

// "15 / 27 in stock · 56%"
export function formatStockStats(row: StockChartRow): string {
  if (row.count === 0) return 'No cats'
  return `${row.inStockCount} / ${row.count} in stock · ${row.inStockPct}%`
}

function _getNiceStep(roughStep: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(roughStep))
  const multiplier = [1, 2, 5].find((m) => m * magnitude >= roughStep) ?? 10
  return multiplier * magnitude
}

function _toPct(value: number, max: number): number {
  return max === 0 ? 0 : (value / max) * 100
}

function _formatCatCount(count: number): string {
  return `${count} ${count === 1 ? 'cat' : 'cats'}`
}
