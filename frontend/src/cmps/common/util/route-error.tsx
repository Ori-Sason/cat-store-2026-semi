import type React from 'react'
import { isRouteErrorResponse, Link, useRouteError } from 'react-router'
import { errorService } from '../../../services/error.service'

// The errorElement of the pathless routes - a thrown loader
// error (ApiError, or a 404 response for an unknown path) renders here
export const RouteError: React.FC = () => {
  const err = useRouteError()
  const isNotFound = isRouteErrorResponse(err) && err.status === 404

  return (
    <section className="route-error">
      <h1>{isNotFound ? 'Page not found' : 'Something went wrong'}</h1>
      <p>{isNotFound ? "There's nothing at this address." : errorService.getErrorMsg(err)}</p>
      <Link to="/cat" className="main-btn">
        Back to cats
      </Link>
    </section>
  )
}
