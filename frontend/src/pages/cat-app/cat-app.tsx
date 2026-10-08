import type React from 'react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLoaderData, useLocation, useNavigation, useSearchParams } from 'react-router'
import { catFilterService, catPermissionService, type CatFilter } from '@cat-store/shared'
import { CatFilterBar } from '../../cmps/cat-app/cat-filter-bar'
import { CatList } from '../../cmps/cat-app/cat-list'
import { useDebouncedCallback } from '../../hooks/use-debounced-callback'
import { useLoggedInUserStore } from '../../store/logged-in-user.store'
import type { catAppLoader } from './cat-app.loader'

const FILTER_DEBOUNCE_MS = 500

export const CatApp: React.FC = () => {
  const { cats, filterBy } = useLoaderData<typeof catAppLoader>()
  const [, setSearchParams] = useSearchParams()
  const navigation = useNavigation()
  const location = useLocation()
  const loggedInUser = useLoggedInUserStore((state) => state.loggedInUser)

  // Filter debouncer
  const [draftFilterBy, setDraftFilterBy] = useState(filterBy)
  const filterKey = new URLSearchParams(catFilterService.filterToParams(filterBy)).toString()
  const lastWrittenRef = useRef(filterKey)
  const writeUrl = useDebouncedCallback((filterBy: CatFilter) => {
    const params = new URLSearchParams(catFilterService.filterToParams(filterBy))
    lastWrittenRef.current = params.toString()
    setSearchParams(params, { replace: true })
  }, FILTER_DEBOUNCE_MS)

  // Cancel filtering on clicks, e.g header link, Back
  const { cancel: cancelWrite } = writeUrl
  useEffect(() => {
    if (filterKey === lastWrittenRef.current) return
    lastWrittenRef.current = filterKey
    cancelWrite()
    setDraftFilterBy(catFilterService.paramsToFilter(new URLSearchParams(filterKey)))
  }, [filterKey, cancelWrite])

  const isLoading = writeUrl.isPending || navigation.location?.pathname === location.pathname

  function onSetFilter(filterBy: CatFilter) {
    setDraftFilterBy(filterBy)
    writeUrl.call(filterBy)
  }

  const isCanAddCat = catPermissionService.canAddCat(loggedInUser)

  return (
    <section className="cat-app">
      <header className="page-head">
        <h1>Cats</h1>
        <span className="count">
          {cats.length} {cats.length === 1 ? 'cat' : 'cats'}
        </span>
        {isCanAddCat && (
          <Link to="/cat/new" state={{ listSearch: location.search }} className="main-btn add-btn">
            + Add cat
          </Link>
        )}
      </header>
      <CatFilterBar filterBy={draftFilterBy} onSetFilter={onSetFilter} />
      <div className={`list-container ${isLoading ? 'is-loading' : ''}`}>
        <CatList cats={cats} />
      </div>
    </section>
  )
}
