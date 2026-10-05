import { render, screen } from '@testing-library/react'
import { CAT_LABELS, type CatLabelStats } from '@cat-store/shared'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RouteError } from '../../cmps/util/route-error'
import { ApiError } from '../../models/api-error'
import { catService } from '../../services/cat.service'
import { CatDashboard } from './cat-dashboard'
import { catDashboardLoader } from './cat-dashboard.loader'

vi.mock('../../services/cat.service')

const _ZERO_STATS: CatLabelStats[] = CAT_LABELS.map((label) => ({
  label,
  count: 0,
  inStockCount: 0,
  medianPrice: null,
  minPrice: null,
  maxPrice: null,
}))

const _STATS: CatLabelStats[] = _ZERO_STATS.map((s) =>
  s.label === 'Kitten'
    ? { ...s, count: 3, inStockCount: 2, medianPrice: 100, minPrice: 70, maxPrice: 180 }
    : s,
)

function _render() {
  const router = createMemoryRouter(
    [
      {
        errorElement: <RouteError />,
        children: [{ path: '/dashboard', loader: catDashboardLoader, element: <CatDashboard /> }],
      },
    ],
    { initialEntries: ['/dashboard'] },
  )
  render(<RouterProvider router={router} />)
}

describe('CatDashboard', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('shows both chart sections and the disclaimer', async () => {
    vi.mocked(catService.getLabelStats).mockResolvedValue(_STATS)
    _render()

    expect(await screen.findByRole('heading', { name: 'Dashboard' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Price per label' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'In stock per label' })).toBeInTheDocument()
    expect(screen.getByRole('note')).toBeInTheDocument()
    expect(screen.queryByText('No labelled cats yet')).not.toBeInTheDocument()
  })

  it('shows the empty state when no label has cats', async () => {
    vi.mocked(catService.getLabelStats).mockResolvedValue(_ZERO_STATS)
    _render()

    expect(await screen.findByText('No labelled cats yet')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Price per label' })).not.toBeInTheDocument()
  })

  it('shows the route error when the stats fail to load', async () => {
    vi.mocked(catService.getLabelStats).mockRejectedValue(
      new ApiError(0, 'NETWORK_ERROR', 'Network Error'),
    )
    _render()

    expect(await screen.findByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
  })
})
