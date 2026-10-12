import { render, screen, within } from '@testing-library/react'
import type { Cat, PublicUser } from '@cat-store/shared'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UserCats } from '../../cmps/user-details/user-cats'
import { RouteError } from '../../cmps/common/util/route-error'
import { ApiError } from '../../models/api-error'
import { catService } from '../../services/cat.service'
import { userService } from '../../services/user.service'
import { utilService } from '../../services/util.service'
import { userCatsLoader } from './user-cats.loader'
import { UserDetails } from './user-details'
import { userDetailsLoader } from './user-details.loader'

vi.mock('../../services/user.service')
vi.mock('../../services/cat.service')

function _buildUser(_id: string, fullname: string): PublicUser {
  return { _id, fullname, isAdmin: false, createdAt: Date.UTC(2026, 9, 4, 12) }
}

function _buildCat(_id: string, name: string, ownerId: string): Cat {
  return {
    _id,
    ownerId,
    name,
    price: 100,
    labels: [],
    isInStock: true,
    imgUrl: '',
    createdAt: 1,
    updatedAt: 1,
  }
}

const MAYA = _buildUser('user-1', 'Maya Levi')
const NOAM = _buildUser('user-2', 'Noam Cohen')
const MAYA_CAT = _buildCat('cat-1', 'Mitzi', MAYA._id)

// Like the app's route: the cats tab is an index child route with its own loader
function _renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        // Like the app's root route: no fallback logs a warning while the first loader runs
        HydrateFallback: () => null,
        errorElement: <RouteError />,
        children: [
          {
            path: '/user/:id',
            loader: userDetailsLoader,
            shouldRevalidate: utilService.skipReloadOnActionAt('/review'),
            element: <UserDetails />,
            children: [{ index: true, loader: userCatsLoader, element: <UserCats /> }],
          },
        ],
      },
    ],
    { initialEntries: [path] },
  )
  render(<RouterProvider router={router} />)
  return router
}

describe('UserDetails', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    vi.mocked(userService.getById).mockImplementation(async (userId) =>
      userId === NOAM._id ? NOAM : MAYA,
    )
    vi.mocked(catService.query).mockResolvedValue([MAYA_CAT])
  })

  it("shows the user's header and their cats on the cats tab", async () => {
    _renderAt('/user/user-1')

    expect(await screen.findByRole('heading', { name: 'Maya Levi' })).toBeInTheDocument()
    expect(screen.getByText('Joined Oct 4, 2026')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Mitzi' })).toBeInTheDocument()
    expect(userService.getById).toHaveBeenCalledWith('user-1')
    expect(catService.query).toHaveBeenCalledWith(expect.objectContaining({ ownerId: 'user-1' }))
  })

  it('marks the cats tab as the current page', async () => {
    _renderAt('/user/user-1')

    const tabs = await screen.findByRole('navigation', { name: 'User sections' })
    expect(within(tabs).getByRole('link', { name: 'Cats' })).toHaveAttribute('aria-current', 'page')
  })

  it('says so when the user has no cats', async () => {
    vi.mocked(catService.query).mockResolvedValue([])
    _renderAt('/user/user-1')

    expect(await screen.findByText('No cats listed yet.')).toBeInTheDocument()
  })

  // The tab's loader is deferred, so its failure stays in the tab's <Await>
  it('keeps the header when the cats request fails', async () => {
    vi.mocked(catService.query).mockRejectedValue(new ApiError(500, 'INTERNAL', 'boom'))
    _renderAt('/user/user-1')

    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong')
    expect(screen.getByRole('heading', { name: 'Maya Levi' })).toBeInTheDocument()
  })

  it('shows the route error for a user that does not exist', async () => {
    vi.mocked(userService.getById).mockRejectedValue(
      new ApiError(404, 'USER_NOT_FOUND', 'User not found'),
    )
    _renderAt('/user/nope')

    expect(await screen.findByText("User doesn't exist (anymore).")).toBeInTheDocument()
  })

  // Without the key on the tab's <Suspense>, Maya's cats would stay under Noam's header
  // until Noam's arrived
  it("shows the skeleton, not the last user's cats, while another user's cats load", async () => {
    const router = _renderAt('/user/user-1')
    expect(await screen.findByRole('heading', { name: 'Mitzi' })).toBeInTheDocument()

    vi.mocked(catService.query).mockReturnValue(new Promise<never>(() => {}))
    await router.navigate('/user/user-2')

    expect(await screen.findByRole('heading', { name: 'Noam Cohen' })).toBeInTheDocument()
    expect(screen.getByLabelText('Loading cats')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Mitzi' })).not.toBeInTheDocument()
  })
})
