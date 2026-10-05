import { render, screen, within } from '@testing-library/react'
import type { CatLabelStats } from '@cat-store/shared'
import { describe, expect, it } from 'vitest'
import { LabelStockChart } from './label-stock-chart'

const _STATS: CatLabelStats[] = [
  { label: 'Kitten', count: 4, inStockCount: 3, medianPrice: 100, minPrice: 70, maxPrice: 180 },
  { label: 'Senior', count: 0, inStockCount: 0, medianPrice: null, minPrice: null, maxPrice: null },
]

describe('LabelStockChart', () => {
  it('shows the in-stock count next to each label', () => {
    render(<LabelStockChart labelStats={_STATS} />)
    const [kitten, senior] = screen.getAllByRole('listitem')

    expect(within(kitten).getByText('3 / 4 in stock · 75%')).toBeInTheDocument()
    expect(within(senior).getByText('No cats')).toBeInTheDocument()
  })
})
