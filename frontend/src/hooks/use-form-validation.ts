import { useState } from 'react'
import { z } from 'zod'

// Distributes over a union schema (login | signup), so each branch's keys count.
// A plain `keyof (A | B)` keeps only the keys both share.
type _Field<S extends z.ZodType> =
  z.input<S> extends infer I ? (I extends unknown ? keyof I & string : never) : never

// Validates `input` against `schema` on every render. Errors show once a field is
// touched (blurred) or the form is submitted. Form values stay with the caller, so it
// can convert them first (e.g. a price string to a number).
export function useFormValidation<S extends z.ZodType>(
  schema: S,
  input: unknown,
  idPrefix: string,
) {
  const [touched, setTouched] = useState<Partial<Record<string, boolean>>>({})
  const [isSubmitted, setIsSubmitted] = useState(false)

  const formParseResult = schema.safeParse(input) as z.ZodSafeParseResult<z.output<S>>
  const fieldErrors: Partial<Record<string, string[]>> = formParseResult.success
    ? {}
    : z.flattenError(formParseResult.error).fieldErrors

  function getError(field: _Field<S>) {
    return touched[field] || isSubmitted ? fieldErrors[field]?.[0] : undefined
  }

  function getErrorId(field: _Field<S>) {
    return `${idPrefix}-${field}-error`
  }

  // The id and a11y props for a field's input. The caller adds value and onChange.
  function getFieldProps(field: _Field<S>, hintId?: string) {
    const error = getError(field)
    const describedBy = [hintId, error && getErrorId(field)].filter(Boolean).join(' ')
    return {
      id: `${idPrefix}-${field}`,
      onBlur: () => setTouched((prev) => ({ ...prev, [field]: true })),
      'aria-invalid': !!error,
      'aria-describedby': describedBy || undefined,
    }
  }

  function markSubmitted() {
    setIsSubmitted(true)
  }

  return { formParseResult, getError, getErrorId, getFieldProps, markSubmitted }
}
