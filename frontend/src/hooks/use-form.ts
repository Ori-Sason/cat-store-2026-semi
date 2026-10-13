import type React from 'react'
import { useState } from 'react'
import type { z } from 'zod'
import { useFormValidation, type FormField } from './use-form-validation'

// Form keys that can hold any string, so they can back a text input or textarea.
// Fields with a literal union type like 'S' | 'L' are rejected: onChange writes whatever
// the user typed, which may be outside the union. That's why it's `string extends F[K]`,
// not `F[K] extends string`
type _TextField<F> = { [K in keyof F]: string extends F[K] ? K : never }[keyof F] & string

interface UseFormOptions<F, S extends z.ZodType> {
  initialForm: F | (() => F)
  schema: S
  idPrefix: string
  // Converts the raw form values before validation (e.g. a price string to a number).
  // Without it, the form is validated as is
  toInput?: (form: F) => unknown
  // Called with the parsed schema output, only when the form is valid
  onValidSubmit: (data: z.output<S>) => void
}

// Owns the form values and wires them to useFormValidation: input props, error props
// and the submit handler. Each form still lays out its own fields and labels.
export function useForm<F extends object, S extends z.ZodType>({
  initialForm,
  schema,
  idPrefix,
  toInput,
  onValidSubmit,
}: UseFormOptions<F, S>) {
  const [form, setForm] = useState(initialForm)
  const formValidation = useFormValidation(schema, toInput ? toInput(form) : form, idPrefix)

  function setField<K extends keyof F>(field: K, value: F[K]) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  // value, onChange, id, onBlur and the a11y props, ready to spread on the input
  function getTextFieldProps(field: _TextField<F> & FormField<S>, hintId?: string) {
    return {
      value: form[field] as string,
      onChange: (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
        setForm((prev) => ({ ...prev, [field]: ev.target.value })),
      ...formValidation.getFieldProps(field, hintId),
    }
  }

  // Spread on <FieldError />
  function getErrorProps(field: FormField<S>) {
    return { errorId: formValidation.getErrorId(field), errorTxt: formValidation.getError(field) }
  }

  function onSubmit(ev: React.SubmitEvent<HTMLFormElement>) {
    ev.preventDefault()
    formValidation.markSubmitted()
    const { formParseResult } = formValidation
    if (formParseResult.success) onValidSubmit(formParseResult.data)
  }

  return { form, setField, getTextFieldProps, getErrorProps, onSubmit }
}
