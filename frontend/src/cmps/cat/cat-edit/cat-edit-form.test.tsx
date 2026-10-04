import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CAT_LABELS, type Cat } from '@cat-store/shared'
import { MemoryRouter } from 'react-router'
import { describe, expect, it, vi } from 'vitest'
import { CatEditForm } from './cat-edit-form'

const _CAT = {
  _id: 'cat-1',
  name: 'Mitzi',
  price: 95.5,
  labels: ['Calm'],
  isInStock: false,
  imgUrl: '',
  createdAt: 1,
  updatedAt: 1,
} satisfies Cat

function _render(cat: Cat | null = null) {
  const onSave = vi.fn()
  render(
    <MemoryRouter>
      <CatEditForm cat={cat} isSaving={false} cancelTo="/cat" onSave={onSave} />
    </MemoryRouter>,
  )
  return { onSave, user: userEvent.setup() }
}

describe('CatEditForm', () => {
  it('shows no errors before the user does anything', () => {
    _render()

    expect(screen.queryByText('Name must be at least 2 characters')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'false')
  })

  it('shows a field error after leaving the field', async () => {
    const { user } = _render()

    await user.type(screen.getByLabelText('Name'), 'M')
    expect(screen.queryByText('Name must be at least 2 characters')).not.toBeInTheDocument()
    await user.tab()

    expect(screen.getByText('Name must be at least 2 characters')).toBeInTheDocument()
    expect(screen.getByLabelText('Name')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByText('Price must be a number')).not.toBeInTheDocument()
  })

  it('shows every error on submit and does not save an invalid cat', async () => {
    const { onSave, user } = _render()

    await user.type(screen.getByLabelText('Image URL'), 'not a url')
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Name must be at least 2 characters')).toBeInTheDocument()
    expect(screen.getByText('Price must be a number')).toBeInTheDocument()
    expect(screen.getByText('Image must be a valid URL')).toBeInTheDocument()
    expect(onSave).not.toHaveBeenCalled()
  })

  it('saves a valid cat with a numeric price and a trimmed name', async () => {
    const { onSave, user } = _render()

    await user.type(screen.getByLabelText('Name'), '  Tom  ')
    await user.type(screen.getByLabelText('Price ($)'), '120.5')
    await user.click(screen.getByRole('button', { name: 'Kitten' }))
    await user.click(screen.getByRole('switch', { name: 'In stock' }))
    await user.click(screen.getByRole('button', { name: 'Save' }))

    expect(onSave).toHaveBeenCalledWith({
      name: 'Tom',
      price: 120.5,
      labels: ['Kitten'],
      isInStock: false,
      imgUrl: '',
    })
  })

  it('selects and removes every label in one click', async () => {
    const { user } = _render(_CAT)
    const isPressed = () =>
      CAT_LABELS.map((label) =>
        screen.getByRole('button', { name: label }).getAttribute('aria-pressed'),
      )

    await user.click(screen.getByRole('button', { name: 'Select all' }))
    expect(isPressed()).toEqual(CAT_LABELS.map(() => 'true'))
    expect(screen.getByRole('button', { name: 'Select all' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Remove all' }))
    expect(isPressed()).toEqual(CAT_LABELS.map(() => 'false'))
    expect(screen.getByRole('button', { name: 'Remove all' })).toBeDisabled()
  })

  it('starts from the cat on edit', async () => {
    const { onSave, user } = _render(_CAT)

    expect(screen.getByLabelText('Name')).toHaveValue('Mitzi')
    expect(screen.getByLabelText('Price ($)')).toHaveValue('95.5')
    expect(screen.getByRole('button', { name: 'Calm' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('switch', { name: 'In stock' })).not.toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledWith({
      name: 'Mitzi',
      price: 95.5,
      labels: ['Calm'],
      isInStock: false,
      imgUrl: '',
    })
  })
})
