import type { LoaderFunctionArgs } from 'react-router'
import { catService } from '../../services/cat.service'

// The cat only, awaited: a missing cat throws to the route error element.
// The reviews come from the reviews child route's own loader, which runs in parallel with this
// one. Split so a review action reloads only the reviews, not the cat
export async function catDetailsLoader({ params }: Pick<LoaderFunctionArgs, 'params'>) {
  const cat = await catService.getById(params.id!)
  return { cat }
}
