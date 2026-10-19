import type React from 'react'
import { useState } from 'react'
import { useFetcher } from 'react-router'
import type { ReviewContentInput, ReviewWithRefs } from '@cat-store/shared'
import type { reviewAction } from '../../../pages/review/review.action'
import { ActionsMenu } from '../util/actions-menu'
import { ConfirmModal } from '../util/confirm-modal'
import { ReviewEdit } from './review-edit'

interface ReviewEditableProps {
  review: ReviewWithRefs
}

// The body of a review the viewer may edit: the ⋮ menu, the text or its edit form, and the
// delete confirm. ReviewPreview renders it only when canEditReview allows, so only these
// reviews get a fetcher. Each owns its own, so one review's saving / deleting state and result
// never leak into another's. Both post to the action-only /review/:id route
export const ReviewEditable: React.FC<ReviewEditableProps> = ({ review }) => {
  const fetcher = useFetcher<typeof reviewAction>()
  const [isEditing, setIsEditing] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)
  const isBusy = fetcher.state !== 'idle'
  const isSaving = isBusy && fetcher.formMethod === 'PUT'
  const isDeleting = isBusy && fetcher.formMethod === 'DELETE'

  // Close the edit form once a save succeeded and the list reloaded, so the new text replaces
  // the form with no flash of the old one. A failed save returns no review: the form stays
  // open with the typed text. Set during render, like the add form's key in CatReviews
  const [handledData, setHandledData] = useState(fetcher.data)
  if (fetcher.state === 'idle' && fetcher.data !== handledData) {
    setHandledData(fetcher.data)
    if (fetcher.data?.review) setIsEditing(false)
  }

  function onSave(input: ReviewContentInput) {
    void fetcher.submit(input, {
      method: 'put',
      action: `/review/${review._id}`,
      encType: 'application/json',
    })
  }

  function onConfirmDelete() {
    setIsConfirmOpen(false)
    void fetcher.submit(null, { method: 'delete', action: `/review/${review._id}` })
  }

  return (
    <>
      {!isEditing && (
        <ActionsMenu
          label="Review actions"
          isDisabled={isDeleting}
          onEdit={() => setIsEditing(true)}
          onDelete={() => setIsConfirmOpen(true)}
        />
      )}

      {isEditing ? (
        <ReviewEdit
          initialContent={review.content}
          isSaving={isSaving}
          onSave={onSave}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <p className={`content ${isDeleting ? 'is-deleting' : ''}`} aria-busy={isDeleting}>
          {review.content}
        </p>
      )}

      <ConfirmModal
        isOpen={isConfirmOpen}
        title="Delete this review?"
        msg="This can't be undone."
        confirmTxt="Delete"
        onConfirm={onConfirmDelete}
        onClose={() => setIsConfirmOpen(false)}
      />
    </>
  )
}
