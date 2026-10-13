import type React from 'react'
import { useId } from 'react'
import {
  REVIEW_CONTENT_MAX_LENGTH,
  reviewContentSchema,
  type ReviewContentInput,
} from '@cat-store/shared'
import { useForm } from '../../../hooks/use-form'
import { FieldError } from '../util/field-error'

interface ReviewEditProps {
  isSaving: boolean
  onSave: (input: ReviewContentInput) => void
  // Edit mode: prefilled, with Save and Cancel. Without them it's the empty add form
  initialContent?: string
  onCancel?: () => void
}

// Content only: the caller knows which cat the review is on. To clear it after a save, the
// caller remounts it with a new key - that also resets the touched / submitted state
export const ReviewEdit: React.FC<ReviewEditProps> = ({
  isSaving,
  onSave,
  initialContent = '',
  onCancel,
}) => {
  // The add form and any open edit forms share a page, so each needs its own ids
  const idPrefix = useId()
  const hintId = `${idPrefix}-hint`
  const { form, getTextFieldProps, getErrorProps, onSubmit } = useForm({
    initialForm: { content: initialContent },
    schema: reviewContentSchema,
    idPrefix,
    onValidSubmit: onSave,
  })
  const contentProps = getTextFieldProps('content', hintId)
  const isEdit = !!onCancel
  const [submitTxt, savingTxt] = isEdit ? ['Save', 'Saving…'] : ['Post review', 'Posting…']

  return (
    <form className="review-edit" noValidate onSubmit={onSubmit}>
      <label htmlFor={contentProps.id}>{isEdit ? 'Edit your review' : 'Your review'}</label>
      <textarea
        rows={3}
        // Edit mode opens from the ⋮ menu, which unmounts: without this, focus drops to <body>.
        // The add form sits on the page from the start, so it doesn't grab focus
        autoFocus={isEdit}
        {...contentProps}
      />
      <div className="foot">
        <FieldError {...getErrorProps('content')} />
        <p id={hintId} className="hint">
          {form.content.length} / {REVIEW_CONTENT_MAX_LENGTH}
        </p>
      </div>
      <div className="actions">
        <button type="submit" className="main-btn" disabled={isSaving}>
          {isSaving ? savingTxt : submitTxt}
        </button>
        {isEdit && (
          <button type="button" className="sub-btn" disabled={isSaving} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  )
}
