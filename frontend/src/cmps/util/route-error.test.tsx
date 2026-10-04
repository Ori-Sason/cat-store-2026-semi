import { render, screen } from '@testing-library/react'
import { createMemoryRouter, data, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../models/api-error'
import { errorService } from '../../services/error.service'
import { RouteError } from './route-error'

// The same shape as router.tsx: a pathless route whose errorElement catches its children's loaders
function _renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        errorElement: <RouteError />,
        children: [
          {
            path: '/offline',
            loader: () => {
              throw new ApiError(0, 'NETWORK_ERROR', 'Network Error')
            },
            element: <div />,
          },
          {
            path: '*',
            loader: () => {
              throw data(null, { status: 404 })
            },
          },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
}

describe('RouteError', () => {
  beforeEach(() => {
    // react-router logs every caught route error - keep test output clean
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('shows "Page not found" for an unknown path', async () => {
    _renderAt('/nope')

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument()
  })

  it('shows the user-facing msg for an ApiError thrown by a loader', async () => {
    _renderAt('/offline')

    expect(await screen.findByText(errorService.ERROR_MSG_MAP.NETWORK_ERROR)).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Something went wrong' })).toBeInTheDocument()
  })

  it('links back to the cat list', async () => {
    _renderAt('/nope')

    expect(await screen.findByRole('link', { name: 'Back to cats' })).toHaveAttribute(
      'href',
      '/cat',
    )
  })
})
