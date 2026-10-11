import type React from 'react'
import { useState } from 'react'
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
}

// Content only: the caller knows which cat the review is on. To clear it after a save, the
// caller remounts it with a new key - that also resets the touched / submitted state
export const ReviewEdit: React.FC<ReviewEditProps> = ({ isSaving, onSave }) => {
  const [content, setContent] = useState('')
  const formValidation = useFormValidation(reviewContentSchema, { content }, 'review')
  const { formParseResult } = formValidation

  function onSubmit(ev: React.SubmitEvent<HTMLFormElement>) {
    ev.preventDefault()
    formValidation.markSubmitted()
    if (formParseResult.success) onSave(formParseResult.data)
  }

  return (
    <form className="review-edit" noValidate onSubmit={onSubmit}>
      <label htmlFor="review-content">Your review</label>
      <textarea
        rows={3}
        value={content}
        onChange={(ev) => setContent(ev.target.value)}
        {...formValidation.getFieldProps('content', 'review-content-hint')}
      />
      <div className="foot">
        <FieldError
          errorId={formValidation.getErrorId('content')}
          errorTxt={formValidation.getError('content')}
        />
        <p id="review-content-hint" className="hint">
          {content.length} / {REVIEW_CONTENT_MAX_LENGTH}
        </p>
      </div>
      <button type="submit" className="main-btn" disabled={isSaving}>
        {isSaving ? 'Posting…' : 'Post review'}
      </button>
    </form>
  )
}
