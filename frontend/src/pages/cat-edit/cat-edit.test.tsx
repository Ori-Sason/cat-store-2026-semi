import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Cat } from '@cat-store/shared'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { RouteError } from '../../cmps/util/route-error'
import { ApiError } from '../../models/api-error'
import { catService } from '../../services/cat.service'
import { useUserMsgStore } from '../../store/user-msg.store'
import { CatEdit } from './cat-edit'
import { catEditAction } from './cat-edit.action'
import { catEditLoader } from './cat-edit.loader'

vi.mock('../../services/cat.service')

const _CAT = {
  _id: 'cat-1',
  name: 'Mitzi',
  price: 95.5,
  labels: ['Calm'],
  isInStock: true,
  imgUrl: '',
  createdAt: 1,
  updatedAt: 1,
} satisfies Cat

function _renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/cat', element: <p>Cat list</p> },
      { path: '/cat/:id', element: <p>Cat details</p> },
      {
        errorElement: <RouteError />,
        children: [
          { path: '/cat/new', loader: catEditLoader, action: catEditAction, element: <CatEdit /> },
          {
            path: '/cat/:id/edit',
            loader: catEditLoader,
            action: catEditAction,
            element: <CatEdit />,
          },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return { router, user: userEvent.setup() }
}

describe('CatEdit', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    useUserMsgStore.setState({ msg: null, navigationMsg: null })
    vi.mocked(catService.getById).mockResolvedValue(_CAT)
  })

  it('edits the cat from the URL and cancels back to its details', async () => {
    _renderAt('/cat/cat-1/edit')

    expect(await screen.findByRole('heading', { name: 'Edit cat' })).toBeInTheDocument()
    expect(catService.getById).toHaveBeenCalledWith('cat-1')
    expect(screen.getByLabelText('Name')).toHaveValue('Mitzi')
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/cat/cat-1')
  })

  it('adds a cat from an empty form and cancels back to the list', async () => {
    _renderAt('/cat/new')

    expect(await screen.findByRole('heading', { name: 'Add cat' })).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveValue('')
    expect(screen.getByLabelText('Price ($)')).toHaveValue('')
    expect(screen.getByRole('link', { name: 'Cancel' })).toHaveAttribute('href', '/cat')
  })

  it('saves the cat and lands on its details', async () => {
    vi.mocked(catService.save).mockResolvedValue({ ..._CAT, name: 'Mitzi Jr' })
    const { router, user } = _renderAt('/cat/cat-1/edit')

    const nameInput = await screen.findByLabelText('Name')
    await user.clear(nameInput)
    await user.type(nameInput, 'Mitzi Jr')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/cat/cat-1'))
    expect(catService.save).toHaveBeenCalledWith({
      name: 'Mitzi Jr',
      price: 95.5,
      labels: ['Calm'],
      isInStock: true,
      imgUrl: '',
      _id: 'cat-1',
    })
  })

  it.each([
    ['the server rejects the cat', new ApiError(400, 'VALIDATION_FAILED', 'Invalid body')],
    ['the server is down', new ApiError(0, 'NETWORK_ERROR', 'Network Error')],
  ])('stays on the page with the form filled when %s', async (_case, err) => {
    vi.mocked(catService.save).mockRejectedValue(err)
    const { router, user } = _renderAt('/cat/new')

    await user.type(await screen.findByLabelText('Name'), 'Tom')
    await user.type(screen.getByLabelText('Price ($)'), '120')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    await waitFor(() => expect(useUserMsgStore.getState().msg?.type).toBe('error'))
    await waitFor(() => expect(router.state.navigation.state).toBe('idle'))
    expect(router.state.location.pathname).toBe('/cat/new')
    expect(screen.getByLabelText('Name')).toHaveValue('Tom')
    expect(screen.getByLabelText('Price ($)')).toHaveValue('120')
    expect(screen.getByRole('button', { name: 'Save' })).toBeEnabled()
  })
})
