import type React from 'react'
import { useEffect, useRef } from 'react'
import {
  CAT_LABELS,
  catFilterService,
  DEFAULT_CAT_FILTER,
  type CatFilter,
  type CatLabel,
  type CatSortField,
  type SortByDirection,
} from '@cat-store/shared'
import { LABEL_COLORS } from '../../models/label'

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

  function onToggleLabel(label: CatLabel) {
    const isOn = filterBy.labels.includes(label)
    const labels = CAT_LABELS.filter((l) => (l === label ? !isOn : filterBy.labels.includes(l)))
    onSetFilter({ ...filterBy, labels })
  }

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
      <div className="labels" role="group" aria-label="Labels">
        {CAT_LABELS.map((label) => {
          const { bg, fg } = LABEL_COLORS[label]
          return (
            <button
              key={label}
              type="button"
              className="label-toggle"
              style={{ '--label-bg': bg, '--label-fg': fg } as React.CSSProperties}
              aria-pressed={filterBy.labels.includes(label)}
              onClick={() => onToggleLabel(label)}
            >
              {label}
            </button>
          )
        })}
      </div>
    </form>
  )
}
