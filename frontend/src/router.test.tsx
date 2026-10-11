import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { routes } from './router'

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
})
