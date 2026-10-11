import type React from 'react'
import { useId, useState } from 'react'
import {
  REVIEW_CONTENT_MAX_LENGTH,
  reviewContentSchema,
  type ReviewContentInput,
} from '@cat-store/shared'
import { useFormValidation } from '../../../hooks/use-form-validation'
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
  const [content, setContent] = useState(initialContent)
  // The add form and any open edit forms share a page, so each needs its own ids
  const idPrefix = useId()
  const formValidation = useFormValidation(reviewContentSchema, { content }, idPrefix)
  const { formParseResult } = formValidation
  const fieldProps = formValidation.getFieldProps('content', `${idPrefix}-hint`)
  const isEdit = !!onCancel
  const [submitTxt, savingTxt] = isEdit ? ['Save', 'Saving…'] : ['Post review', 'Posting…']

  function onSubmit(ev: React.SubmitEvent<HTMLFormElement>) {
    ev.preventDefault()
    formValidation.markSubmitted()
    if (formParseResult.success) onSave(formParseResult.data)
  }

  return (
    <form className="review-edit" noValidate onSubmit={onSubmit}>
      <label htmlFor={fieldProps.id}>{isEdit ? 'Edit your review' : 'Your review'}</label>
      <textarea
        rows={3}
        value={content}
        onChange={(ev) => setContent(ev.target.value)}
        // Edit mode opens from the ⋮ menu, which unmounts: without this, focus drops to <body>.
        // The add form sits on the page from the start, so it doesn't grab focus
        autoFocus={isEdit}
        {...fieldProps}
      />
      <div className="foot">
        <FieldError
          errorId={formValidation.getErrorId('content')}
          errorTxt={formValidation.getError('content')}
        />
        <p id={`${idPrefix}-hint`} className="hint">
          {content.length} / {REVIEW_CONTENT_MAX_LENGTH}
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
