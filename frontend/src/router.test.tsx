import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import type { Cat } from '@cat-store/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from './router'
import { catService } from './services/cat.service'
import { reviewService } from './services/review.service'

vi.mock('./services/cat.service')
vi.mock('./services/review.service')

// The real route config, for what lives only there
function _renderAt(path: string) {
  render(<RouterProvider router={createMemoryRouter(routes, { initialEntries: [path] })} />)
}

describe('routes', () => {
  beforeEach(() => {
    // react-router logs every caught route error - keep test output clean
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it.each(['/review', '/review/review-1', '/no-such-page'])(
    'shows "Page not found" for a visit to %s',
    async (path) => {
      _renderAt(path)

      expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
    },
  )

  // The reviews section is a child route of /cat/:id with its own loader
  it("renders the cat's reviews section from its child route", async () => {
    vi.mocked(catService.getById).mockResolvedValue({
      _id: 'cat-1',
      name: 'Mitzi',
      labels: [],
    } as unknown as Cat)
    vi.mocked(reviewService.query).mockResolvedValue([])
    _renderAt('/cat/cat-1')

    expect(await screen.findByText('No reviews yet')).toBeInTheDocument()
    expect(reviewService.query).toHaveBeenCalledWith({ catId: 'cat-1' })
  })
})
