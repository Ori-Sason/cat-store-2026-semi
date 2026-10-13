import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ReviewEdit } from './review-edit'

function _render(isSaving = false) {
  const onSave = vi.fn()
  render(<ReviewEdit isSaving={isSaving} onSave={onSave} />)
  return { onSave, user: userEvent.setup() }
}

describe('ReviewEdit', () => {
  // When errors show (touch, submit) is covered by useFormValidation's tests. These check the wiring.
  it('shows the error on submit and does not save a blank review', async () => {
    const { onSave, user } = _render()

    await user.type(screen.getByLabelText('Your review'), '   ')
    await user.click(screen.getByRole('button', { name: 'Post review' }))

    expect(screen.getByText('Review is required')).toBeInTheDocument()
    expect(screen.getByLabelText('Your review')).toHaveAttribute('aria-invalid', 'true')
    expect(onSave).not.toHaveBeenCalled()
  })

  it('does not save a review over the max length', async () => {
    const { onSave, user } = _render()

    await user.click(screen.getByLabelText('Your review'))
    await user.paste('a'.repeat(501))
    await user.click(screen.getByRole('button', { name: 'Post review' }))

    expect(screen.getByText('Review must be at most 500 characters')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('saves the content trimmed', async () => {
    const { onSave, user } = _render()

    await user.type(screen.getByLabelText('Your review'), '  Such a sweet cat  ')
    await user.click(screen.getByRole('button', { name: 'Post review' }))

    expect(onSave).toHaveBeenCalledWith({ content: 'Such a sweet cat' })
  })

  it('counts the characters against the max', async () => {
    const { user } = _render()

    await user.type(screen.getByLabelText('Your review'), 'Purr')

    expect(screen.getByText('4 / 500')).toBeInTheDocument()
  })

  it('disables submit while saving', () => {
    _render(true)

    expect(screen.getByRole('button', { name: 'Posting…' })).toBeDisabled()
  })
})
