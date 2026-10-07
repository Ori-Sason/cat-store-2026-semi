import { fireEvent, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useDismiss } from './use-dismiss'

function _render(isOpen: boolean) {
  const popup = document.createElement('div')
  document.body.append(popup)
  const onDismiss = vi.fn()
  const hook = renderHook(({ isOpen }) => useDismiss({ current: popup }, isOpen, onDismiss), {
    initialProps: { isOpen },
  })
  return { popup, onDismiss, ...hook }
}

describe('useDismiss', () => {
  afterEach(() => {
    document.body.innerHTML = ''
  })

  it('dismisses on Escape', () => {
    const { onDismiss } = _render(true)

    fireEvent.keyDown(document, { key: 'Escape' })

    expect(onDismiss).toHaveBeenCalledOnce()
    expect(onDismiss.mock.calls[0][0].type).toBe('keydown')
  })

  it('ignores other keys', () => {
    const { onDismiss } = _render(true)

    fireEvent.keyDown(document, { key: 'Enter' })

    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('dismisses on a press outside the popup', () => {
    const { onDismiss } = _render(true)

    fireEvent.pointerDown(document.body)

    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('ignores a press inside the popup', () => {
    const { popup, onDismiss } = _render(true)
    const item = document.createElement('button')
    popup.append(item)

    fireEvent.pointerDown(item)

    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('does nothing while closed, and stops listening once closed', () => {
    const { onDismiss, rerender } = _render(false)
    fireEvent.keyDown(document, { key: 'Escape' })

    rerender({ isOpen: true })
    rerender({ isOpen: false })
    fireEvent.keyDown(document, { key: 'Escape' })
    fireEvent.pointerDown(document.body)

    expect(onDismiss).not.toHaveBeenCalled()
  })
})
