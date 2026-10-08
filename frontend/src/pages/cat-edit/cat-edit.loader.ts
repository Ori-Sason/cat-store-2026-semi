import { catPermissionService } from '@cat-store/shared'
import { redirect, type LoaderFunctionArgs } from 'react-router'
import { ApiError } from '../../models/api-error'
import { catService } from '../../services/cat.service'
import { useLoggedInUserStore } from '../../store/logged-in-user.store'

// No id = /cat/new. Guards a typed or bookmarked URL the same way the hidden buttons do:
// a guest goes to login and comes back here after it, a user who can't edit the cat gets
// the 403 route error. The server still checks on save, this only spares a form that would fail
export async function catEditLoader({
  params,
  request,
}: Pick<LoaderFunctionArgs, 'params' | 'request'>) {
  const { loggedInUser } = useLoggedInUserStore.getState()
  if (!catPermissionService.canAddCat(loggedInUser)) {
    const { pathname, search } = new URL(request.url)
    throw redirect(`/login?redirectTo=${encodeURIComponent(pathname + search)}`)
  }
  if (!params.id) return { cat: null }

  const cat = await catService.getById(params.id)
  if (!catPermissionService.canEditCat(cat, loggedInUser)) {
    throw new ApiError(403, 'FORBIDDEN', `Cat ${cat._id} isn't yours`)
  }
  return { cat }
}
