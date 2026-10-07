import { act, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'
import { useFormValidation } from './use-form-validation'

const _schema = z.object({
  name: z.string().min(1, 'Name is required'),
  age: z.number().min(0, 'Age must be positive'),
})

const _INVALID = { name: '', age: -1 }

function _render(input: unknown = _INVALID) {
  return renderHook(() => useFormValidation(_schema, input, 'test'))
}

describe('useFormValidation', () => {
  it('hides errors before a touch or submit, even on invalid input', () => {
    const { result } = _render()

    expect(result.current.formParseResult.success).toBe(false)
    expect(result.current.getError('name')).toBeUndefined()
    expect(result.current.getFieldProps('name')).toMatchObject({
      id: 'test-name',
      'aria-invalid': false,
      'aria-describedby': undefined,
    })
  })

  it('shows the error of a blurred field only', () => {
    const { result } = _render()

    act(() => result.current.getFieldProps('name').onBlur())

    expect(result.current.getError('name')).toBe('Name is required')
    expect(result.current.getError('age')).toBeUndefined()
    expect(result.current.getFieldProps('name')).toMatchObject({
      'aria-invalid': true,
      'aria-describedby': 'test-name-error',
    })
  })

  it('shows every error after submit', () => {
    const { result } = _render()

    act(() => result.current.markSubmitted())

    expect(result.current.getError('name')).toBe('Name is required')
    expect(result.current.getError('age')).toBe('Age must be positive')
  })

  it('joins the hint id with the error id', () => {
    const { result } = _render()
    expect(result.current.getFieldProps('name', 'name-hint')['aria-describedby']).toBe('name-hint')

    act(() => result.current.markSubmitted())

    expect(result.current.getFieldProps('name', 'name-hint')['aria-describedby']).toBe(
      'name-hint test-name-error',
    )
  })

  it('returns the parsed data on valid input', () => {
    const { result } = _render({ name: 'Mitzi', age: 3 })

    act(() => result.current.markSubmitted())

    expect(result.current.formParseResult).toEqual({
      success: true,
      data: { name: 'Mitzi', age: 3 },
    })
    expect(result.current.getError('name')).toBeUndefined()
  })
})
