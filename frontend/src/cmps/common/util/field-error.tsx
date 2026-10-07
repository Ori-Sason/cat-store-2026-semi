import type React from 'react'

interface FieldErrorProps {
  errorId: string
  errorTxt?: string
}

export const FieldError: React.FC<FieldErrorProps> = ({ errorId, errorTxt }) => {
  if (!errorTxt) return null
  return (
    <p id={errorId} className="field-error">
      {errorTxt}
    </p>
  )
}
