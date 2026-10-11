import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ReviewActionsMenu } from './review-actions-menu'

function _render(isDisabled = false) {
  const onEdit = vi.fn()
  const onDelete = vi.fn()
  render(<ReviewActionsMenu isDisabled={isDisabled} onEdit={onEdit} onDelete={onDelete} />)
  return { onEdit, onDelete }
}

// jsdom has no Popover API: test-setup emulates showing, hiding and the popovertarget click
describe('ReviewActionsMenu', () => {
  it('opens Edit / Delete from the ⋮ button', async () => {
    _render()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Review actions' }))

    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it.each(['Edit', 'Delete'] as const)('closes the menu, then runs %s', async (option) => {
    const handlers = _render()

    await userEvent.click(screen.getByRole('button', { name: 'Review actions' }))
    await userEvent.click(screen.getByRole('button', { name: option }))

    expect(screen.queryByRole('button', { name: option })).not.toBeInTheDocument()
    expect(handlers[option === 'Edit' ? 'onEdit' : 'onDelete']).toHaveBeenCalledOnce()
  })

  it('disables the ⋮ button', () => {
    _render(true)

    expect(screen.getByRole('button', { name: 'Review actions' })).toBeDisabled()
  })
})
