import type React from 'react'
import { useEffect, useRef } from 'react'
import {
  catFilterService,
  DEFAULT_CAT_FILTER,
  type CatFilter,
  type CatSortField,
  type SortByDirection,
} from '@cat-store/shared'
import { LabelToggles } from '../label-toggles'

interface SortOption {
  txt: string
  sortBy: CatSortField
  sortDir: SortByDirection
}

const SORT_OPTIONS: SortOption[] = [
  { txt: 'Newest first', sortBy: 'createdAt', sortDir: 'desc' },
  { txt: 'Oldest first', sortBy: 'createdAt', sortDir: 'asc' },
  { txt: 'Name A–Z', sortBy: 'name', sortDir: 'asc' },
  { txt: 'Name Z–A', sortBy: 'name', sortDir: 'desc' },
  { txt: 'Price: low to high', sortBy: 'price', sortDir: 'asc' },
  { txt: 'Price: high to low', sortBy: 'price', sortDir: 'desc' },
]

const STOCK_OPTIONS: { txt: string; isInStock: CatFilter['isInStock'] }[] = [
  { txt: 'Any', isInStock: null },
  { txt: 'In stock', isInStock: true },
  { txt: 'Sold out', isInStock: false },
]

interface CatFilterBarProps {
  filterBy: CatFilter
  onSetFilter: (filterBy: CatFilter) => void
}

export const CatFilterBar: React.FC<CatFilterBarProps> = ({ filterBy, onSetFilter }) => {
  const txtRef = useRef<HTMLInputElement>(null)

  // Uncontrolled so typing never lags behind the URL; synced when the URL changes from elsewhere (e.g. Back).
  // Compared trimmed - the URL drops a trailing space the user is still typing
  useEffect(() => {
    const input = txtRef.current
    if (input && input.value.trim() !== filterBy.txt) input.value = filterBy.txt
  }, [filterBy.txt])

  const sortValue = `${filterBy.sortBy}-${filterBy.sortDir}`
  const isDefault = catFilterService.filterToParams(filterBy).length === 0

  function onSetSort(value: string) {
    const option = SORT_OPTIONS.find(({ sortBy, sortDir }) => `${sortBy}-${sortDir}` === value)
    if (option) onSetFilter({ ...filterBy, sortBy: option.sortBy, sortDir: option.sortDir })
  }

  return (
    <form className="cat-filter-bar" role="search" onSubmit={(ev) => ev.preventDefault()}>
      <div className="controls">
        <input
          ref={txtRef}
          type="search"
          defaultValue={filterBy.txt}
          placeholder="Search by name"
          aria-label="Search by name"
          onChange={(ev) => onSetFilter({ ...filterBy, txt: ev.target.value })}
        />
        <div className="stock" role="group" aria-label="Availability">
          {STOCK_OPTIONS.map(({ txt, isInStock }) => (
            <button
              key={txt}
              type="button"
              aria-pressed={filterBy.isInStock === isInStock}
              onClick={() => onSetFilter({ ...filterBy, isInStock })}
            >
              {txt}
            </button>
          ))}
        </div>
        <select
          aria-label="Sort by"
          value={sortValue}
          onChange={(ev) => onSetSort(ev.target.value)}
        >
          {SORT_OPTIONS.map(({ txt, sortBy, sortDir }) => (
            <option key={txt} value={`${sortBy}-${sortDir}`}>
              {txt}
            </option>
          ))}
        </select>
        {!isDefault && (
          <button type="button" className="sub-btn" onClick={() => onSetFilter(DEFAULT_CAT_FILTER)}>
            Clear
          </button>
        )}
      </div>
      <LabelToggles
        labels={filterBy.labels}
        onChange={(labels) => onSetFilter({ ...filterBy, labels })}
        aria-label="Labels"
      />
    </form>
  )
}
