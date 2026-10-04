import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DEFAULT_CAT_FILTER, type Cat } from '@cat-store/shared'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { catService } from '../../services/cat.service'
import { CatApp } from './cat-app'
import { catAppLoader } from './cat-app.loader'

vi.mock('../../services/cat.service')

const _CATS = [
  {
    _id: 'cat-1',
    name: 'Mitzi',
    price: 120,
    labels: ['Calm'],
    isInStock: true,
    imgUrl: '',
    createdAt: 1,
    updatedAt: 1,
  },
] satisfies Cat[]

function LocationStateProbe() {
  return <pre>{JSON.stringify(useLocation().state)}</pre>
}

function _renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/cat', loader: catAppLoader, element: <CatApp /> },
      { path: '/cat/new', element: <LocationStateProbe /> },
      { path: '/cat/:id', element: <LocationStateProbe /> },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('CatApp', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(catService.query).mockResolvedValue(_CATS)
  })

  it('shows the cats the loader got for the URL filter', async () => {
    _renderAt('/cat?isInStock=true')

    expect(await screen.findByRole('heading', { name: 'Mitzi' })).toBeInTheDocument()
    expect(catService.query).toHaveBeenCalledWith({ ...DEFAULT_CAT_FILTER, isInStock: true })
    expect(screen.getByRole('button', { name: 'In stock' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('hands the list filter to the add page', async () => {
    const router = _renderAt('/cat?labels=Calm')

    await userEvent.click(await screen.findByRole('link', { name: '+ Add cat' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/cat/new'))
    expect(screen.getByText('{"listSearch":"?labels=Calm"}')).toBeInTheDocument()
  })

  it('writes a filter change to the URL and loads again', async () => {
    const router = _renderAt('/cat')
    await screen.findByRole('heading', { name: 'Mitzi' })

    await userEvent.click(screen.getByRole('button', { name: 'Calm' }))

    await waitFor(() => expect(router.state.location.search).toBe('?labels=Calm'))
    await waitFor(() =>
      expect(catService.query).toHaveBeenLastCalledWith({
        ...DEFAULT_CAT_FILTER,
        labels: ['Calm'],
      }),
    )
  })

  it('hands the list filter to the details page', async () => {
    const router = _renderAt('/cat?labels=Calm')

    await userEvent.click(await screen.findByRole('heading', { name: 'Mitzi' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/cat/cat-1'))
    expect(screen.getByText('{"listSearch":"?labels=Calm"}')).toBeInTheDocument()
  })
})
