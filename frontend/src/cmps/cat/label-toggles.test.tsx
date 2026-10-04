import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { CatLabel } from '@cat-store/shared'
import { describe, expect, it, vi } from 'vitest'
import { LabelToggles } from './label-toggles'

function _render(labels: CatLabel[]) {
  const onChange = vi.fn()
  render(<LabelToggles labels={labels} onChange={onChange} aria-label="Labels" />)
  return { onChange, user: userEvent.setup() }
}

describe('LabelToggles', () => {
  it('marks the labels that are on', () => {
    _render(['Calm'])

    expect(screen.getByRole('group', { name: 'Labels' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Calm' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Kitten' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('adds a label in CAT_LABELS order, not click order', async () => {
    const { onChange, user } = _render(['Calm'])

    await user.click(screen.getByRole('button', { name: 'Kitten' }))

    expect(onChange).toHaveBeenCalledWith(['Kitten', 'Calm'])
  })

  it('removes a label that is on', async () => {
    const { onChange, user } = _render(['Kitten', 'Calm'])

    await user.click(screen.getByRole('button', { name: 'Calm' }))

    expect(onChange).toHaveBeenCalledWith(['Kitten'])
  })
})
