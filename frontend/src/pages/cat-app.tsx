import type React from 'react'
import { useLoaderData } from 'react-router'
import { CatList } from '../cmps/cat/cat-list'
import type { catAppLoader } from './cat-app.loader'

export const CatApp: React.FC = () => {
  const { cats } = useLoaderData<typeof catAppLoader>()

  return (
    <section className="cat-app">
      <header className="page-head">
        <h1>Cats</h1>
        <span className="count">
          {cats.length} {cats.length === 1 ? 'cat' : 'cats'}
        </span>
      </header>
      <CatList cats={cats} />
    </section>
  )
}
