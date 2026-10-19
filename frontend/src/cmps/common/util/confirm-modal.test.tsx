import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ConfirmModal } from './confirm-modal'

function _renderModal(isOpen = true) {
  const onConfirm = vi.fn()
  const onClose = vi.fn()
  const view = render(
    <ConfirmModal
      isOpen={isOpen}
      title="Delete Mitzi?"
      msg="This can't be undone."
      confirmTxt="Delete"
      onConfirm={onConfirm}
      onClose={onClose}
    />,
  )
  return { ...view, onConfirm, onClose }
}

describe('ConfirmModal', () => {
  it('opens as an alertdialog named by its title and described by its msg', () => {
    _renderModal()

    const dialog = screen.getByRole('alertdialog', { name: 'Delete Mitzi?' })
    expect(dialog).toHaveAttribute('open')
    expect(dialog).toHaveAccessibleDescription("This can't be undone.")
  })

  it('stays closed while isOpen is false', () => {
    _renderModal(false)

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
  })

  it('calls onConfirm from the confirm button', async () => {
    const { onConfirm, onClose } = _renderModal()

    await userEvent.click(screen.getByRole('button', { name: 'Delete' }))

    expect(onConfirm).toHaveBeenCalledOnce()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('calls onClose from Cancel', async () => {
    const { onClose } = _renderModal()

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose when the dialog closes itself (Esc)', () => {
    const { onClose } = _renderModal()

    act(() => screen.getByRole<HTMLDialogElement>('alertdialog').close())

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose on a backdrop click, not on a click inside', async () => {
    const { onClose } = _renderModal()

    await userEvent.click(screen.getByText("This can't be undone."))
    expect(onClose).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('alertdialog'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
