import { DEFAULT_CAT_FILTER } from '@cat-store/shared'
import { NEWEST_CATS_LIMIT } from '../../models/home'
import { catService } from '../../services/cat.service'

// Not async on purpose: the promises go out un-awaited, so navigation and the hero don't wait
// on the API. The page resolves each one in its own <Await>, so a failed call breaks only its
// section instead of throwing to the route error element.
// react-router needs an object of promises here, not a bare promise
export function homeLoader() {
  return {
    // The default sort is createdAt desc, so the limit keeps the newest
    newestCats: _withSilentReject(
      catService.query({ ...DEFAULT_CAT_FILTER, limit: NEWEST_CATS_LIMIT }),
    ),
    labelStats: _withSilentReject(catService.getLabelStats()),
  }
}

// Only <Await> attaches a rejection handler, and only once it renders. If the user leaves
// before Home mounts, a failed call would log "Uncaught (in promise)". The no-op catch is a
// second listener: the same promise is returned, so <Await> still gets the rejection
function _withSilentReject<T>(promise: Promise<T>): Promise<T> {
  promise.catch(() => {})
  return promise
}
