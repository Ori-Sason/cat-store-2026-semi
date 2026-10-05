import { render, screen, within } from '@testing-library/react'
import type { CatLabelStats } from '@cat-store/shared'
import { describe, expect, it } from 'vitest'
import { LabelPriceChart } from './label-price-chart'

const _STATS: CatLabelStats[] = [
  { label: 'Kitten', count: 3, inStockCount: 2, medianPrice: 100, minPrice: 70, maxPrice: 180 },
  { label: 'Senior', count: 0, inStockCount: 0, medianPrice: null, minPrice: null, maxPrice: null },
]

describe('LabelPriceChart', () => {
  it('shows the stats next to each label', () => {
    render(<LabelPriceChart labelStats={_STATS} />)
    const [kitten, senior] = screen.getAllByRole('listitem')

    expect(within(kitten).getByText('Kitten')).toBeInTheDocument()
    expect(within(kitten).getByText('median $100 · $70–$180 · 3 cats')).toBeInTheDocument()
    expect(within(senior).getByText('No cats')).toBeInTheDocument()
  })

  it('labels the axis from $0 up to the rounded top price', () => {
    const { container } = render(<LabelPriceChart labelStats={_STATS} />)
    const ticks = [...container.querySelectorAll('.axis .axis-label')].map((el) => el.textContent)

    expect(ticks).toEqual(['$0', '$50', '$100', '$150', '$200'])
  })
})
