import { render, screen } from '@testing-library/react'
import type { Cat } from '@cat-store/shared'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { CatList } from './cat-list'

function _cat(overrides: Partial<Cat>): Cat {
  return {
    _id: 'cat-1',
    ownerId: 'user-1',
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

function _renderList(cats: Cat[]) {
  render(
    <MemoryRouter>
      <CatList cats={cats} emptyText="Nothing here" />
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

  it("shows the page's empty text when there are no cats", () => {
    _renderList([])

    expect(screen.getByText('Nothing here')).toBeInTheDocument()
  })
})
