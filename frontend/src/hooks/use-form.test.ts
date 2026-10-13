import type React from 'react'
import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { useForm } from './use-form'

// When errors show (touch, submit) is covered by useFormValidation's tests.
// These check what useForm adds: the form state, the input wiring and the submit flow.
const _schema = z.object({
  name: z.string().min(1, 'Name is required'),
  age: z.number('Age must be a number'),
  isActive: z.boolean(),
})

interface _Form {
  name: string
  age: string
  isActive: boolean
}

const _EMPTY_FORM: _Form = { name: '', age: '', isActive: false }

function _toInput(form: _Form) {
  return { ...form, age: form.age === '' ? undefined : Number(form.age) }
}

function _render(initialForm: _Form | (() => _Form) = _EMPTY_FORM) {
  const onValidSubmit = vi.fn()
  const { result } = renderHook(() =>
    useForm({ initialForm, schema: _schema, idPrefix: 'test', toInput: _toInput, onValidSubmit }),
  )
  return { result, onValidSubmit }
}

function _changeEvent(value: string) {
  return { target: { value } } as React.ChangeEvent<HTMLInputElement>
}

type _SubmitEvent = React.SubmitEvent<HTMLFormElement>

function _submit(result: { current: { onSubmit: (ev: _SubmitEvent) => void } }) {
  const ev = { preventDefault: vi.fn() } as unknown as _SubmitEvent
  act(() => result.current.onSubmit(ev))
  return ev
}

describe('useForm', () => {
  it('starts from the initial form, or a function that returns it', () => {
    const { result } = _render(() => ({ name: 'Mitzi', age: '3', isActive: true }))

    expect(result.current.form).toEqual({ name: 'Mitzi', age: '3', isActive: true })
  })

  it('gives a text field its value, id and a11y props, and updates it on change', () => {
    const { result } = _render()

    expect(result.current.getTextFieldProps('name', 'name-hint')).toMatchObject({
      value: '',
      id: 'test-name',
      'aria-invalid': false,
      'aria-describedby': 'name-hint',
    })

    act(() => result.current.getTextFieldProps('name').onChange(_changeEvent('Mitzi')))

    expect(result.current.form.name).toBe('Mitzi')
    expect(result.current.getTextFieldProps('name').value).toBe('Mitzi')
  })

  it('shows the error of a text field after its blur', () => {
    const { result } = _render()
    expect(result.current.getErrorProps('name')).toEqual({
      errorId: 'test-name-error',
      errorTxt: undefined,
    })

    act(() => result.current.getTextFieldProps('name').onBlur())

    expect(result.current.getErrorProps('name').errorTxt).toBe('Name is required')
    expect(result.current.getErrorProps('age').errorTxt).toBeUndefined()
  })

  it('sets a non-text field', () => {
    const { result } = _render()

    act(() => result.current.setField('isActive', true))

    expect(result.current.form.isActive).toBe(true)
  })

  it('shows every error on an invalid submit and does not call onValidSubmit', () => {
    const { result, onValidSubmit } = _render()

    const ev = _submit(result)

    expect(ev.preventDefault).toHaveBeenCalled()
    expect(result.current.getErrorProps('name').errorTxt).toBe('Name is required')
    expect(result.current.getErrorProps('age').errorTxt).toBe('Age must be a number')
    expect(onValidSubmit).not.toHaveBeenCalled()
  })

  it('submits the parsed data, converted by toInput', () => {
    const { result, onValidSubmit } = _render({ name: 'Mitzi', age: '3', isActive: true })

    _submit(result)

    expect(onValidSubmit).toHaveBeenCalledWith({ name: 'Mitzi', age: 3, isActive: true })
  })

  it('validates the form as is without toInput', () => {
    const onValidSubmit = vi.fn()
    const { result } = renderHook(() =>
      useForm({
        initialForm: { name: 'Mitzi' },
        schema: z.object({ name: z.string() }),
        idPrefix: 'test',
        onValidSubmit,
      }),
    )

    _submit(result)

    expect(onValidSubmit).toHaveBeenCalledWith({ name: 'Mitzi' })
  })
})
