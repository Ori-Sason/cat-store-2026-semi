import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DEFAULT_CAT_FILTER, type CatFilter } from '@cat-store/shared'
import { describe, expect, it, vi } from 'vitest'
import { CatFilterBar } from './cat-filter-bar'

function _renderBar(filterBy: CatFilter = DEFAULT_CAT_FILTER) {
  const onSetFilter = vi.fn()
  const view = render(<CatFilterBar filterBy={filterBy} onSetFilter={onSetFilter} />)
  return { onSetFilter, ...view }
}

describe('CatFilterBar', () => {
  it('adds a label, keeping CAT_LABELS order', async () => {
    const { onSetFilter } = _renderBar({ ...DEFAULT_CAT_FILTER, labels: ['Calm'] })

    await userEvent.click(screen.getByRole('button', { name: 'Kitten' }))

    expect(onSetFilter).toHaveBeenCalledWith({ ...DEFAULT_CAT_FILTER, labels: ['Kitten', 'Calm'] })
  })

  it('removes a label that is on', async () => {
    const { onSetFilter } = _renderBar({ ...DEFAULT_CAT_FILTER, labels: ['Calm'] })

    expect(screen.getByRole('button', { name: 'Calm' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Calm' }))

    expect(onSetFilter).toHaveBeenCalledWith(DEFAULT_CAT_FILTER)
  })

  it.each([
    ['In stock', true],
    ['Sold out', false],
  ])('maps "%s" to isInStock: %s', async (txt, isInStock) => {
    const { onSetFilter } = _renderBar()

    await userEvent.click(screen.getByRole('button', { name: txt }))

    expect(onSetFilter).toHaveBeenCalledWith({ ...DEFAULT_CAT_FILTER, isInStock })
  })

  it('maps "Any" back to isInStock: null', async () => {
    const { onSetFilter } = _renderBar({ ...DEFAULT_CAT_FILTER, isInStock: false })

    await userEvent.click(screen.getByRole('button', { name: 'Any' }))

    expect(onSetFilter).toHaveBeenCalledWith(DEFAULT_CAT_FILTER)
  })

  it('maps a sort option to sortBy and sortDir', async () => {
    const { onSetFilter } = _renderBar()

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Sort by' }),
      'Price: low to high',
    )

    expect(onSetFilter).toHaveBeenCalledWith({
      ...DEFAULT_CAT_FILTER,
      sortBy: 'price',
      sortDir: 'asc',
    })
  })

  it('sends the typed name', async () => {
    const { onSetFilter } = _renderBar()

    await userEvent.type(screen.getByRole('searchbox', { name: 'Search by name' }), 't')

    expect(onSetFilter).toHaveBeenCalledWith({ ...DEFAULT_CAT_FILTER, txt: 't' })
  })

  it('syncs the search box when the filter changes from outside', () => {
    const { rerender } = _renderBar({ ...DEFAULT_CAT_FILTER, txt: 'tom' })

    rerender(<CatFilterBar filterBy={DEFAULT_CAT_FILTER} onSetFilter={vi.fn()} />)

    expect(screen.getByRole('searchbox', { name: 'Search by name' })).toHaveValue('')
  })

  it('shows Clear only for a non-default filter, and it resets to the default', async () => {
    const { onSetFilter, rerender } = _renderBar()
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument()

    rerender(
      <CatFilterBar filterBy={{ ...DEFAULT_CAT_FILTER, txt: 'tom' }} onSetFilter={onSetFilter} />,
    )
    await userEvent.click(screen.getByRole('button', { name: 'Clear' }))

    expect(onSetFilter).toHaveBeenCalledWith(DEFAULT_CAT_FILTER)
  })
})
