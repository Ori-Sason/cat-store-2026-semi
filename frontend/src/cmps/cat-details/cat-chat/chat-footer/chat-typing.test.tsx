import { render, screen } from '@testing-library/react'
import type { UserRef } from '@cat-store/shared'
import { describe, expect, it } from 'vitest'
import { ChatTyping } from './chat-typing'

const NAMES = ['Maya Levi', 'Noam Cohen', 'Dana Katz', 'Admin User']

function _render(count: number) {
  const typers: UserRef[] = NAMES.slice(0, count).map((fullname, i) => ({
    _id: `user-${i}`,
    fullname,
    isAdmin: false,
  }))
  return render(<ChatTyping typers={typers} />)
}

describe('ChatTyping', () => {
  it('renders nothing while nobody types', () => {
    const { container } = _render(0)
    expect(container).toBeEmptyDOMElement()
  })

  it('names one typer', () => {
    _render(1)
    expect(screen.getByText('Maya Levi is typing…')).toBeInTheDocument()
  })

  it('names two typers', () => {
    _render(2)
    expect(screen.getByText('Maya Levi and Noam Cohen are typing…')).toBeInTheDocument()
  })

  it('names the first two of three and counts the third', () => {
    _render(3)
    expect(screen.getByText('Maya Levi, Noam Cohen and 1 other are typing…')).toBeInTheDocument()
  })

  it('counts the rest past two', () => {
    _render(4)
    expect(screen.getByText('Maya Levi, Noam Cohen and 2 others are typing…')).toBeInTheDocument()
  })
})
