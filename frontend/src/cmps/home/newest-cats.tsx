import type React from 'react'
import { Suspense } from 'react'
import { Await, Link } from 'react-router'
import type { Cat } from '@cat-store/shared'
import { CatPreview } from '../common/cat/cat-preview'
import { HomeSectionError } from './home-section-error'
import { NewestCatsSkeleton } from './newest-cats-skeleton'

interface NewestCatsProps {
  cats: Promise<Cat[]> // from the home loader, un-awaited
}

// The band and its heading render right away. Only the cards wait on the API.
// CatPreview is used directly, not CatList: its "No cats match these filters" is wrong here
export const NewestCats: React.FC<NewestCatsProps> = ({ cats }) => {
  return (
    <section className="newest-cats">
      <div className="head">
        <h2>Newest cats</h2>
        <Link to="/cat">
          See all cats <span aria-hidden="true">→</span>
        </Link>
      </div>

      <Suspense fallback={<NewestCatsSkeleton />}>
        <Await resolve={cats} errorElement={<HomeSectionError />}>
          {(cats) =>
            cats.length ? (
              <ul className="cat-list clean-list">
                {cats.map((cat) => (
                  <li key={cat._id}>
                    <CatPreview cat={cat} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="empty">No cats listed yet</p>
            )
          }
        </Await>
      </Suspense>
    </section>
  )
}
