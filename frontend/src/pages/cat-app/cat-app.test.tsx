import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DEFAULT_CAT_FILTER, type Cat } from '@cat-store/shared'
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { catService } from '../../services/cat.service'
import { CatApp } from './cat-app'
import { catAppLoader } from './cat-app.loader'

vi.mock('../../services/cat.service')

// Restated, not imported - the test pins the delay the page promises
const _FILTER_DEBOUNCE_MS = 500

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

  describe('debounced filter', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    async function _renderLoaded() {
      vi.useFakeTimers({ shouldAdvanceTime: true })
      const router = _renderAt('/cat')
      await screen.findByRole('heading', { name: 'Mitzi' })
      return router
    }

    it('flips chips at once and loads once for a burst of clicks', async () => {
      const router = await _renderLoaded()

      fireEvent.click(screen.getByRole('button', { name: 'Calm' }))
      fireEvent.click(screen.getByRole('button', { name: 'Kitten' }))

      expect(screen.getByRole('button', { name: 'Calm' })).toHaveAttribute('aria-pressed', 'true')
      expect(screen.getByRole('button', { name: 'Kitten' })).toHaveAttribute('aria-pressed', 'true')
      expect(router.state.location.search).toBe('')

      await act(() => vi.advanceTimersByTimeAsync(_FILTER_DEBOUNCE_MS))

      await waitFor(() => expect(router.state.location.search).toBe('?labels=Kitten&labels=Calm'))
      await waitFor(() => expect(catService.query).toHaveBeenCalledTimes(2))
      expect(catService.query).toHaveBeenLastCalledWith({
        ...DEFAULT_CAT_FILTER,
        labels: ['Kitten', 'Calm'],
      })
    })

    it('loads once with the full text after typing', async () => {
      const router = await _renderLoaded()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })

      await user.type(screen.getByRole('searchbox', { name: 'Search by name' }), 'tom')
      await act(() => vi.advanceTimersByTimeAsync(_FILTER_DEBOUNCE_MS))

      await waitFor(() => expect(router.state.location.search).toBe('?txt=tom'))
      await waitFor(() => expect(catService.query).toHaveBeenCalledTimes(2))
      expect(catService.query).toHaveBeenLastCalledWith({ ...DEFAULT_CAT_FILTER, txt: 'tom' })
    })

    it('lets a URL change from elsewhere replace a pending draft', async () => {
      const router = await _renderLoaded()

      fireEvent.click(screen.getByRole('button', { name: 'Calm' }))
      await act(() => router.navigate('/cat?isInStock=true'))
      await act(() => vi.advanceTimersByTimeAsync(_FILTER_DEBOUNCE_MS))

      expect(router.state.location.search).toBe('?isInStock=true')
      expect(screen.getByRole('button', { name: 'Calm' })).toHaveAttribute('aria-pressed', 'false')
      expect(screen.getByRole('button', { name: 'In stock' })).toHaveAttribute(
        'aria-pressed',
        'true',
      )
      expect(catService.query).not.toHaveBeenCalledWith(
        expect.objectContaining({ labels: ['Calm'] }),
      )
    })
  })

  it('hands the list filter to the details page', async () => {
    const router = _renderAt('/cat?labels=Calm')

    await userEvent.click(await screen.findByRole('heading', { name: 'Mitzi' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/cat/cat-1'))
    expect(screen.getByText('{"listSearch":"?labels=Calm"}')).toBeInTheDocument()
  })
})
