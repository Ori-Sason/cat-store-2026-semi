import type { LoaderFunctionArgs } from 'react-router'
import { userService } from '../../services/user.service'

// The user only, awaited: a missing user throws to the route error element.
// Each tab is a child route with its own loader, which runs in parallel with this one.
// A tab switch doesn't re-run this: the parent's match (/user/:id) stays the same
export async function userDetailsLoader({ params }: Pick<LoaderFunctionArgs, 'params'>) {
  const user = await userService.getById(params.id!)
  return { user }
}
