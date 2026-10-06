import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PICKUP_POINTS } from '../../models/pickup-point'
import { PickupPointList } from './pickup-point-list'

function _render(selectedId: string | null) {
  const onSelect = vi.fn()
  render(
    <PickupPointList pickupPoints={PICKUP_POINTS} selectedId={selectedId} onSelect={onSelect} />,
  )
  return { onSelect, user: userEvent.setup() }
}

describe('PickupPointList', () => {
  it('shows every pickup point with its address and hours', () => {
    _render(null)

    expect(screen.getAllByRole('button')).toHaveLength(PICKUP_POINTS.length)
    for (const point of PICKUP_POINTS) {
      const button = screen.getByRole('button', { name: new RegExp(point.address) })
      expect(button).toHaveTextContent(point.name)
      expect(button).toHaveTextContent(point.hours)
    }
  })

  it('marks only the selected pickup point as pressed', () => {
    _render('haifa')

    expect(screen.getByRole('button', { name: /^Haifa/ })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^Eilat/ })).toHaveAttribute('aria-pressed', 'false')
  })

  it('selects a pickup point on click', async () => {
    const { onSelect, user } = _render(null)

    await user.click(screen.getByRole('button', { name: /^Jerusalem/ }))

    expect(onSelect).toHaveBeenCalledWith('jerusalem')
  })
})
