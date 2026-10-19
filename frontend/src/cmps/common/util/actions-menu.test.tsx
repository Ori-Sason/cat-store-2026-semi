import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ActionsMenu } from './actions-menu'

function _render({ isDisabled = false, isEditable = true } = {}) {
  const onEdit = vi.fn()
  const onDelete = vi.fn()
  render(
    <ActionsMenu
      label="Item actions"
      isDisabled={isDisabled}
      onEdit={isEditable ? onEdit : undefined}
      onDelete={onDelete}
    />,
  )
  return { onEdit, onDelete }
}

// jsdom has no Popover API: test-setup emulates showing, hiding and the popovertarget click
describe('ActionsMenu', () => {
  it('opens Edit / Delete from the ⋮ button', async () => {
    _render()
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Item actions' }))

    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it('shows Delete alone without an onEdit', async () => {
    _render({ isEditable: false })

    await userEvent.click(screen.getByRole('button', { name: 'Item actions' }))

    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument()
  })

  it.each(['Edit', 'Delete'] as const)(
    'closes the menu and focuses the ⋮ button, then runs %s',
    async (option) => {
      const { onEdit, onDelete } = _render()
      const menuBtn = screen.getByRole('button', { name: 'Item actions' })
      // Read inside the handler: the focus has to be in place before the action runs
      let focusedOnRun: Element | null = null
      const handler = option === 'Edit' ? onEdit : onDelete
      handler.mockImplementation(() => (focusedOnRun = document.activeElement))

      await userEvent.click(menuBtn)
      await userEvent.click(screen.getByRole('button', { name: option }))

      expect(screen.queryByRole('button', { name: option })).not.toBeInTheDocument()
      expect(handler).toHaveBeenCalledOnce()
      expect(focusedOnRun).toBe(menuBtn)
    },
  )

  it('disables the ⋮ button', () => {
    _render({ isDisabled: true })

    expect(screen.getByRole('button', { name: 'Item actions' })).toBeDisabled()
  })
})
