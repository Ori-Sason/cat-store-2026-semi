import { DEFAULT_CAT_FILTER } from '@cat-store/shared'
import type { LoaderFunctionArgs } from 'react-router'
import { catService } from '../../services/cat.service'
import { utilService } from '../../services/util.service'

// The cats tab of /user/:id. Not async on purpose, like the home loader: the cats go out
// un-awaited and the tab resolves them in its own <Await>, so a failed call breaks only the tab
// and the user's header stays. No limit: a profile shows all the user's cats
export function userCatsLoader({ params }: Pick<LoaderFunctionArgs, 'params'>) {
  return {
    cats: utilService.withSilentReject(
      catService.query({ ...DEFAULT_CAT_FILTER, ownerId: params.id! }),
    ),
  }
}
