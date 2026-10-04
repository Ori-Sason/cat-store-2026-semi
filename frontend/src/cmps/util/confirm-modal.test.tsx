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
  it('opens as a dialog named by its title', () => {
    _renderModal()

    expect(screen.getByRole('dialog', { name: 'Delete Mitzi?' })).toHaveAttribute('open')
    expect(screen.getByText("This can't be undone.")).toBeInTheDocument()
  })

  it('stays closed while isOpen is false', () => {
    _renderModal(false)

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
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

    act(() => screen.getByRole<HTMLDialogElement>('dialog').close())

    expect(onClose).toHaveBeenCalledOnce()
  })

  it('calls onClose on a backdrop click, not on a click inside', async () => {
    const { onClose } = _renderModal()

    await userEvent.click(screen.getByText("This can't be undone."))
    expect(onClose).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('dialog'))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
