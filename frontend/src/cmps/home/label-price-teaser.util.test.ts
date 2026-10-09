import type { CatLabel, CatLabelStats } from '@cat-store/shared'
import { describe, expect, it } from 'vitest'
import { pickPriceTeaserRows } from './label-price-teaser.util'

function _stats(label: CatLabel, medianPrice: number | null): CatLabelStats {
  return {
    label,
    count: medianPrice === null ? 0 : 1,
    inStockCount: 0,
    medianPrice,
    minPrice: medianPrice,
    maxPrice: medianPrice,
  }
}

describe('pickPriceTeaserRows', () => {
  it('keeps the top 5 by median, highest first, with bars in % of the top median', () => {
    const stats = [
      _stats('Kitten', 100),
      _stats('Adult', 400),
      _stats('Senior', 50),
      _stats('Playful', 200),
      _stats('Calm', 300),
      _stats('Indoor', 250),
    ]

    const rows = pickPriceTeaserRows(stats)

    expect(rows.map((r) => r.label)).toEqual(['Adult', 'Calm', 'Indoor', 'Playful', 'Kitten'])
    expect(rows.map((r) => r.barPct)).toEqual([100, 75, 62.5, 50, 25])
  })

  it('leaves out labels with no median', () => {
    const rows = pickPriceTeaserRows([_stats('Kitten', null), _stats('Calm', 120)])

    expect(rows.map((r) => r.label)).toEqual(['Calm'])
  })

  it('returns fewer than 5 rows when fewer labels have a median', () => {
    expect(pickPriceTeaserRows([_stats('Kitten', 80), _stats('Calm', 120)])).toHaveLength(2)
    expect(pickPriceTeaserRows([_stats('Kitten', null)])).toEqual([])
  })

  it('gives empty bars when the top median is 0', () => {
    expect(pickPriceTeaserRows([_stats('Kitten', 0)])[0]!.barPct).toBe(0)
  })
})
