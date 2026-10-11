import type React from 'react'
import { useState } from 'react'
import { useFetcher } from 'react-router'
import {
  reviewPermissionService,
  type ReviewContentInput,
  type ReviewWithRefs,
} from '@cat-store/shared'
import type { reviewAction } from '../../../pages/review/review.action'
import { utilService } from '../../../services/util.service'
import { useLoggedInUserStore } from '../../../store/logged-in-user.store'
import { ConfirmModal } from '../util/confirm-modal'
import { ReviewEdit } from './review-edit'

interface ReviewPreviewProps {
  review: ReviewWithRefs
}

// Each review owns its fetcher, so one review's saving / deleting state and result never
// leak into another's. Both post to the action-only /review/:id route
export const ReviewPreview: React.FC<ReviewPreviewProps> = ({ review }) => {
  const loggedInUser = useLoggedInUserStore((state) => state.loggedInUser)
  const fetcher = useFetcher<typeof reviewAction>()
  const [isEditing, setIsEditing] = useState(false)
  const [isConfirmOpen, setIsConfirmOpen] = useState(false)

  const isCanEdit = reviewPermissionService.canEditReview({ userId: review.user._id }, loggedInUser)
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
    <article className="review-preview">
      <header>
        <span className="author">{review.user.fullname}</span>
        <time dateTime={new Date(review.createdAt).toISOString()}>
          {utilService.formatDate(review.createdAt)}
        </time>
      </header>

      {isEditing ? (
        <ReviewEdit
          initialContent={review.content}
          isSaving={isSaving}
          onSave={onSave}
          onCancel={() => setIsEditing(false)}
        />
      ) : (
        <p className="content">{review.content}</p>
      )}

      {isCanEdit && !isEditing && (
        <div className="actions">
          <button
            type="button"
            className="sub-btn"
            disabled={isDeleting}
            onClick={() => setIsEditing(true)}
          >
            Edit
          </button>
          <button
            type="button"
            className="danger-outline-btn"
            disabled={isDeleting}
            onClick={() => setIsConfirmOpen(true)}
          >
            {isDeleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      )}

      {isCanEdit && (
        <ConfirmModal
          isOpen={isConfirmOpen}
          title="Delete this review?"
          msg="This can't be undone."
          confirmTxt="Delete"
          onConfirm={onConfirmDelete}
          onClose={() => setIsConfirmOpen(false)}
        />
      )}
    </article>
  )
}
