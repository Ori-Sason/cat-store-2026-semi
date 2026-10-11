import type { LoaderFunctionArgs } from 'react-router'
import { catService } from '../../services/cat.service'
import { reviewService } from '../../services/review.service'
import { utilService } from '../../services/util.service'

// The cat is awaited: a missing cat throws to the route error element. The reviews go out
// first and un-awaited, so both calls run at once and the page paints without waiting on them.
// The page resolves them in their own <Await>, so a failed call breaks only the reviews section
export async function catDetailsLoader({ params }: Pick<LoaderFunctionArgs, 'params'>) {
  const reviews = utilService.withSilentReject(reviewService.query({ catId: params.id! }))
  const cat = await catService.getById(params.id!)
  return { cat, reviews }
}
