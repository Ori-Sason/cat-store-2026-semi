import { fireEvent, render, screen } from '@testing-library/react'
import type { CatLabel } from '@cat-store/shared'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useFitCount } from '../../hooks/use-fit-count'
import { CatLabels } from './cat-labels'

vi.mock('../../hooks/use-fit-count')

const _LABELS: CatLabel[] = ['Kitten', 'Calm', 'Senior', 'Playful']

// jsdom has no popover API
const showPopover = vi.fn()
const hidePopover = vi.fn()
HTMLElement.prototype.showPopover = showPopover
HTMLElement.prototype.hidePopover = hidePopover

function _render(fitCount: number) {
  vi.mocked(useFitCount).mockReturnValue({ rowRef: { current: null }, fitCount })
  const { container } = render(<CatLabels labels={_LABELS} />)
  return {
    moreEl: container.querySelector('.more')!,
    popoverEl: container.querySelector('.more-popover'),
  }
}

describe('CatLabels', () => {
  beforeEach(() => {
    showPopover.mockClear()
    hidePopover.mockClear()
  })

  it('puts only the hidden labels in the popover', () => {
    const { popoverEl } = _render(2)

    expect(popoverEl).toHaveTextContent('SeniorPlayful')
    expect(popoverEl).not.toHaveTextContent('Kitten')
    expect(screen.getByText('2 more labels: Senior, Playful')).toBeInTheDocument()
  })

  it('shows the popover while a mouse hovers the more chip', () => {
    const { moreEl } = _render(2)

    fireEvent.pointerEnter(moreEl, { pointerType: 'mouse' })
    expect(showPopover).toHaveBeenCalledOnce()

    fireEvent.pointerLeave(moreEl, { pointerType: 'mouse' })
    expect(hidePopover).toHaveBeenCalledOnce()
  })

  it('ignores touch, so a tap just opens the cat', () => {
    const { moreEl } = _render(2)

    fireEvent.pointerEnter(moreEl, { pointerType: 'touch' })

    expect(showPopover).not.toHaveBeenCalled()
  })

  it('has no popover when every label fits', () => {
    const { popoverEl } = _render(_LABELS.length)

    expect(popoverEl).toBeNull()
    expect(screen.queryByText(/more labels/)).not.toBeInTheDocument()
  })
})
