import { DEFAULT_CAT_FILTER } from '@cat-store/shared'
import { catService } from '../../services/cat.service'

const NEWEST_CATS_LIMIT = 4

// Not async on purpose: the promises go out un-awaited, so navigation and the hero don't wait
// on the API. The page resolves each one in its own <Await>, so a failed call breaks only its
// section instead of throwing to the route error element.
// react-router needs an object of promises here, not a bare promise
export function homeLoader() {
  return {
    // The default sort is createdAt desc, so the limit keeps the newest
    newestCats: catService.query({ ...DEFAULT_CAT_FILTER, limit: NEWEST_CATS_LIMIT }),
    labelStats: catService.getLabelStats(),
  }
}
