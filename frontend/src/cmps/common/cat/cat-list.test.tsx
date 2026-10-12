import { render, screen } from '@testing-library/react'
import type { CatWithRefs } from '@cat-store/shared'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { CatList } from './cat-list'

function _cat(overrides: Partial<CatWithRefs>): CatWithRefs {
  return {
    _id: 'cat-1',
    owner: { _id: 'user-1', fullname: 'Maya Levi', isAdmin: false },
    name: 'Mitzi',
    price: 120,
    labels: [],
    isInStock: true,
    imgUrl: '',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

function _renderList(cats: CatWithRefs[], isOwnerShown = true) {
  render(
    <MemoryRouter>
      <CatList cats={cats} emptyText="Nothing here" isOwnerShown={isOwnerShown} />
    </MemoryRouter>,
  )
}

describe('CatList', () => {
  it('renders a card per cat, linking to its details', () => {
    _renderList([_cat({}), _cat({ _id: 'cat-2', name: 'Tom' })])

    expect(screen.getByRole('heading', { name: 'Mitzi' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Tom' }).closest('a')).toHaveAttribute(
      'href',
      '/cat/cat-2',
    )
  })

  // How many labels fit is layout - covered by utilService.getFitCount, since jsdom has none
  it("shows the cat's labels", () => {
    _renderList([_cat({ labels: ['Kitten', 'Calm'] })])

    expect(screen.getByText('Kitten')).toBeInTheDocument()
    expect(screen.getByText('Calm')).toBeInTheDocument()
  })

  // Plain text: the card is already a link, so the owner can't be one inside it
  it("shows the owner's name as text, not a link", () => {
    _renderList([_cat({})])

    const owner = screen.getByText('by Maya Levi')
    expect(owner.closest('a')).toHaveAttribute('href', '/cat/cat-1')
    expect(screen.getAllByRole('link')).toHaveLength(1)
  })

  it('hides the owner when isOwnerShown is false', () => {
    _renderList([_cat({})], false)

    expect(screen.queryByText(/Maya Levi/)).not.toBeInTheDocument()
  })

  it("shows the page's empty text when there are no cats", () => {
    _renderList([])

    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })
})
