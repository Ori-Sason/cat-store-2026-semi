import type React from 'react'
import { useLoaderData, useLocation, useNavigation, useSearchParams } from 'react-router'
import { catFilterService, type CatFilter } from '@cat-store/shared'
import { CatFilterBar } from '../../cmps/cat/cat-app/cat-filter-bar'
import { CatList } from '../../cmps/cat/cat-app/cat-list'
import type { catAppLoader } from './cat-app.loader'

export const CatApp: React.FC = () => {
  const { cats, filterBy } = useLoaderData<typeof catAppLoader>()
  const [, setSearchParams] = useSearchParams()
  const navigation = useNavigation()
  const location = useLocation()

  // While the next filter loads, show it right away instead of the one the current cats came from
  const pendingLocation =
    navigation.location?.pathname === location.pathname ? navigation.location : null
  const shownFilterBy = pendingLocation
    ? catFilterService.paramsToFilter(new URLSearchParams(pendingLocation.search))
    : filterBy

  function onSetFilter(filterBy: CatFilter) {
    const params = new URLSearchParams(catFilterService.filterToParams(filterBy))
    setSearchParams(params, { replace: true })
  }

  return (
    <section className="cat-app">
      <header className="page-head">
        <h1>Cats</h1>
        <span className="count">
          {cats.length} {cats.length === 1 ? 'cat' : 'cats'}
        </span>
      </header>
      <CatFilterBar filterBy={shownFilterBy} onSetFilter={onSetFilter} />
      <div className={`list-container ${pendingLocation ? 'is-loading' : ''}`}>
        <CatList cats={cats} />
      </div>
    </section>
  )
}
