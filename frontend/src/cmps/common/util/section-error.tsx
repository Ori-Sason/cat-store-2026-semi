import type React from 'react'
import { useAsyncError } from 'react-router'
import { errorService } from '../../../services/error.service'

// The errorElement of one <Await>: a failed call breaks only its own section,
// while the rest of the page stays up
export const SectionError: React.FC = () => {
  const err = useAsyncError()
  return (
    <p className="section-error" role="alert">
      {errorService.getErrorMsg(err)}
    </p>
  )
}
