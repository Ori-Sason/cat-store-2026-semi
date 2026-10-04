import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Cat } from '@cat-store/shared'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RouteError } from '../../cmps/util/route-error'
import { ApiError } from '../../models/api-error'
import type { CatListLocationState } from '../../models/util'
import { catService } from '../../services/cat.service'
import { useUserMsgStore } from '../../store/user-msg.store'
import { CatDetails } from './cat-details'
import { catDetailsAction } from './cat-details.action'
import { catDetailsLoader } from './cat-details.loader'

vi.mock('../../services/cat.service')

const _CAT = {
  _id: 'cat-1',
  name: 'Mitzi',
  price: 95.5,
  labels: ['Calm', 'Indoor'],
  isInStock: false,
  imgUrl: '',
  createdAt: Date.UTC(2026, 9, 4, 12),
  updatedAt: Date.UTC(2026, 9, 4, 12),
} satisfies Cat

function _renderAt(path: string, state?: CatListLocationState) {
  const router = createMemoryRouter(
    [
      { path: '/cat', element: <p>Cat list</p> },
      {
        errorElement: <RouteError />,
        children: [
          {
            path: '/cat/:id',
            loader: catDetailsLoader,
            action: catDetailsAction,
            element: <CatDetails />,
          },
        ],
      },
    ],
    { initialEntries: [{ pathname: path, state }] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('CatDetails', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(catService.getById).mockResolvedValue(_CAT)
  })

  it('shows the cat the loader got for the id', async () => {
    _renderAt('/cat/cat-1')

    expect(await screen.findByRole('heading', { name: 'Mitzi' })).toBeInTheDocument()
    expect(catService.getById).toHaveBeenCalledWith('cat-1')
    expect(screen.getByText('$95.50')).toBeInTheDocument()
    expect(screen.getByText('Sold out')).toBeInTheDocument()
    expect(screen.getByText('Calm')).toBeInTheDocument()
    expect(screen.getByText('Indoor')).toBeInTheDocument()
    expect(screen.getByText('Added Oct 4, 2026')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '/cat/cat-1/edit')
  })

  it('goes back to the list with the filter it came from', async () => {
    _renderAt('/cat/cat-1', { listSearch: '?labels=Calm' })

    expect(await screen.findByRole('link', { name: '← Back to cats' })).toHaveAttribute(
      'href',
      '/cat?labels=Calm',
    )
  })

  it('goes back to the plain list on a direct visit', async () => {
    _renderAt('/cat/cat-1')

    expect(await screen.findByRole('link', { name: '← Back to cats' })).toHaveAttribute(
      'href',
      '/cat',
    )
  })

  it('does not delete when the confirm is cancelled', async () => {
    _renderAt('/cat/cat-1')
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))

    const dialog = screen.getByRole('dialog', { name: 'Delete Mitzi?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(catService.remove).not.toHaveBeenCalled()
  })

  it('deletes the cat after the confirm and lands on the list', async () => {
    vi.mocked(catService.remove).mockResolvedValue()
    const router = _renderAt('/cat/cat-1')
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))

    const dialog = screen.getByRole('dialog', { name: 'Delete Mitzi?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/cat'))
    expect(catService.remove).toHaveBeenCalledWith('cat-1')
    expect(screen.getByText('Cat list')).toBeInTheDocument()
  })

  it('stays on the page with an error message when the delete fails', async () => {
    const networkErr = new ApiError(0, 'NETWORK_ERROR', 'Network Error')
    vi.mocked(catService.remove).mockRejectedValue(networkErr)
    // the server is down, so a reload of the cat would fail too
    vi.mocked(catService.getById).mockResolvedValueOnce(_CAT).mockRejectedValue(networkErr)
    _renderAt('/cat/cat-1')
    await userEvent.click(await screen.findByRole('button', { name: 'Delete' }))

    const dialog = screen.getByRole('dialog', { name: 'Delete Mitzi?' })
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete' }))

    expect(await screen.findByRole('button', { name: 'Delete' })).toBeEnabled()
    expect(screen.getByRole('heading', { name: 'Mitzi' })).toBeInTheDocument()
    expect(useUserMsgStore.getState().msg).toMatchObject({ type: 'error' })
    expect(catService.getById).toHaveBeenCalledOnce()
  })

  it("shows the not-found message for a cat that doesn't exist", async () => {
    vi.mocked(catService.getById).mockRejectedValue(
      new ApiError(404, 'CAT_NOT_FOUND', 'Cat not found'),
    )
    _renderAt('/cat/nope')

    expect(await screen.findByText("Cat doesn't exist (anymore).")).toBeInTheDocument()
  })
})
