import type { CatLabelStats } from '@cat-store/shared'

export const PRICE_TEASER_LABEL_COUNT = 5

export interface PriceTeaserRow extends CatLabelStats {
  medianPrice: number
  barPct: number // bar width, in % of the top median
}

// The one spot that decides which labels the teaser shows. For now: the top medians.
// Labels with no cats have no median, so they're left out
export function pickPriceTeaserRows(stats: CatLabelStats[]): PriceTeaserRow[] {
  const rows = stats
    .filter((s): s is CatLabelStats & { medianPrice: number } => s.medianPrice !== null)
    .toSorted((a, b) => b.medianPrice - a.medianPrice)
    .slice(0, PRICE_TEASER_LABEL_COUNT)

  const topMedian = rows[0]?.medianPrice ?? 0
  return rows.map((row) => ({
    ...row,
    // A top median of 0 (free cats only) would divide by zero
    barPct: topMedian ? (row.medianPrice / topMedian) * 100 : 0,
  }))
}
